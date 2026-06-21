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


def ok(data):
    return {'statusCode': 200, 'headers': {**CORS, **JSON_H}, 'body': json.dumps(data)}


def err(msg, code=400):
    return {'statusCode': code, 'headers': {**CORS, **JSON_H}, 'body': json.dumps({'error': msg})}


def db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS upload_sessions (
        session_id TEXT PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT NOT NULL,
        total_chunks INT NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMP DEFAULT now()
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS upload_chunks (
        session_id TEXT NOT NULL, chunk_index INT NOT NULL, data BYTEA NOT NULL,
        PRIMARY KEY (session_id, chunk_index)
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT,
        file_size BIGINT DEFAULT 0, cdn_url TEXT NOT NULL,
        description TEXT DEFAULT '', created_at TIMESTAMP DEFAULT now()
    )""")
    return conn, cur


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def handler(event: dict, context) -> dict:
    '''Чанковая загрузка до 50 МБ. Чанки хранятся в PostgreSQL между запросами.'''
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    if method != 'POST':
        return err('only POST', 405)

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    print(f"[filechunk] action={action}")

    conn, cur = db()

    if action == 'init':
        session_id = uuid.uuid4().hex
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type') or 'application/octet-stream'
        total_chunks = int(body.get('total_chunks') or 1)
        description = body.get('description') or ''
        cur.execute(
            "INSERT INTO upload_sessions (session_id, file_name, file_type, total_chunks, description) VALUES (%s,%s,%s,%s,%s)",
            (session_id, file_name, file_type, total_chunks, description)
        )
        print(f"[filechunk] init session={session_id} total={total_chunks}")
        cur.close(); conn.close()
        return ok({'session_id': session_id})

    if action == 'chunk':
        session_id = body.get('session_id')
        chunk_index = int(body.get('chunk_index', 0))
        raw = base64.b64decode(body.get('content_base64') or '')
        print(f"[filechunk] chunk session={session_id} idx={chunk_index} size={len(raw)}")
        cur.execute(
            "INSERT INTO upload_chunks (session_id, chunk_index, data) VALUES (%s,%s,%s) "
            "ON CONFLICT (session_id, chunk_index) DO UPDATE SET data=EXCLUDED.data",
            (session_id, chunk_index, psycopg2.Binary(raw))
        )
        cur.close(); conn.close()
        return ok({'received': chunk_index})

    if action == 'finish':
        session_id = body.get('session_id')
        print(f"[filechunk] finish session={session_id}")

        cur.execute("SELECT file_name, file_type, total_chunks, description FROM upload_sessions WHERE session_id=%s", (session_id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return err('session not found')

        file_name, file_type, total_chunks, description = row
        cur.execute("SELECT chunk_index, data FROM upload_chunks WHERE session_id=%s ORDER BY chunk_index", (session_id,))
        chunks = cur.fetchall()
        print(f"[filechunk] chunks: {len(chunks)}/{total_chunks}")

        if len(chunks) != total_chunks:
            cur.close(); conn.close()
            return err(f'получено {len(chunks)} из {total_chunks} частей')

        raw_bytes = b''.join(bytes(c[1]) for c in chunks)
        print(f"[filechunk] assembled {len(raw_bytes)} bytes, uploading...")

        access_key = os.environ['AWS_ACCESS_KEY_ID']
        s3 = get_s3()
        key = f"uploads/{uuid.uuid4().hex}_{file_name}"
        s3.put_object(Bucket='files', Key=key, Body=raw_bytes, ContentType=file_type)
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        print(f"[filechunk] S3 ok -> {cdn_url}")

        cur.execute(
            "INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (file_name, file_type, len(raw_bytes), cdn_url, description)
        )
        new_id = cur.fetchone()[0]
        cur.execute("DELETE FROM upload_chunks WHERE session_id=%s", (session_id,))
        cur.execute("DELETE FROM upload_sessions WHERE session_id=%s", (session_id,))
        cur.close(); conn.close()
        print(f"[filechunk] done id={new_id}")
        return ok({'id': new_id, 'cdn_url': cdn_url, 'file_size': len(raw_bytes)})

    cur.close(); conn.close()
    return err(f'unknown action: {action}')
