import json
import os
import base64
import uuid
import psycopg2
import boto3

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
}
JSON_H = {'Content-Type': 'application/json'}

_chunks: dict = {}


def ok(data):
    return {'statusCode': 200, 'headers': {**CORS, **JSON_H}, 'body': json.dumps(data)}


def err(msg, code=400):
    return {'statusCode': code, 'headers': {**CORS, **JSON_H}, 'body': json.dumps({'error': msg})}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def get_db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE IF NOT EXISTS project_files ("
        "id SERIAL PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT, "
        "file_size BIGINT DEFAULT 0, cdn_url TEXT NOT NULL, "
        "description TEXT DEFAULT '', created_at TIMESTAMP DEFAULT now())"
    )
    return conn, cur


def handler(event: dict, context) -> dict:
    '''
    Чанковая загрузка файлов до 50 МБ.
    action=init   -> начать сессию, получить session_id
    action=chunk  -> отправить часть (session_id, chunk_index, content_base64)
    action=finish -> собрать все части, залить в S3, сохранить в БД
    '''
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if method != 'POST':
        return err('only POST', 405)

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    print(f"[filechunk] action={action}")

    if action == 'init':
        session_id = uuid.uuid4().hex
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type') or 'application/octet-stream'
        total_chunks = int(body.get('total_chunks') or 1)
        _chunks[session_id] = {
            'file_name': file_name,
            'file_type': file_type,
            'total_chunks': total_chunks,
            'parts': {},
        }
        print(f"[filechunk] init session={session_id} total_chunks={total_chunks}")
        return ok({'session_id': session_id})

    if action == 'chunk':
        session_id = body.get('session_id')
        chunk_index = int(body.get('chunk_index', 0))
        content_b64 = body.get('content_base64') or ''
        raw = base64.b64decode(content_b64)
        print(f"[filechunk] chunk session={session_id} index={chunk_index} size={len(raw)}")
        if session_id not in _chunks:
            return err('session not found — call init first')
        _chunks[session_id]['parts'][chunk_index] = raw
        return ok({'received': chunk_index, 'size': len(raw)})

    if action == 'finish':
        session_id = body.get('session_id')
        description = body.get('description') or ''
        file_size = int(body.get('file_size') or 0)
        print(f"[filechunk] finish session={session_id}")

        if session_id not in _chunks:
            return err('session not found — функция перезапустилась, попробуйте снова')

        sess = _chunks[session_id]
        total = sess['total_chunks']
        parts = sess['parts']

        if len(parts) != total:
            return err(f'получено {len(parts)} из {total} частей')

        raw_bytes = b''.join(parts[i] for i in range(total))
        actual_size = len(raw_bytes)
        print(f"[filechunk] assembled {actual_size} bytes")

        access_key = os.environ['AWS_ACCESS_KEY_ID']
        s3 = get_s3()
        key = f"uploads/{uuid.uuid4().hex}_{sess['file_name']}"
        s3.put_object(Bucket='files', Key=key, Body=raw_bytes, ContentType=sess['file_type'])
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        print(f"[filechunk] S3 ok -> {cdn_url}")

        fn = sess['file_name'].replace("'", "''")
        ft = sess['file_type'].replace("'", "''")
        fu = cdn_url.replace("'", "''")
        fd = description.replace("'", "''")
        conn, cur = get_db()
        cur.execute(
            f"INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) "
            f"VALUES ('{fn}', '{ft}', {actual_size or file_size}, '{fu}', '{fd}') RETURNING id"
        )
        new_id = cur.fetchone()[0]
        cur.close(); conn.close()

        del _chunks[session_id]
        print(f"[filechunk] DB saved id={new_id}")
        return ok({'id': new_id, 'cdn_url': cdn_url, 'file_size': actual_size})

    return err(f'unknown action: {action}')
