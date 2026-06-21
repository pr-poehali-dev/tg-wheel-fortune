import json
import os
import uuid
import base64
import psycopg2
import boto3

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
}
JSON_H = {'Content-Type': 'application/json'}


def ok(data):
    return {'statusCode': 200, 'headers': {**CORS, **JSON_H}, 'body': json.dumps(data)}


def err(msg, code=400):
    return {'statusCode': code, 'headers': {**CORS, **JSON_H}, 'body': json.dumps({'error': msg})}


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
    '''Файлообменник: GET=список, POST=загрузка (base64), DELETE=удаление.'''
    method = event.get('httpMethod', 'GET')
    print(f"[files] method={method} body_len={len(event.get('body') or '')}")

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    conn, cur = get_db()

    if method == 'GET':
        cur.execute(
            "SELECT id, file_name, file_type, file_size, cdn_url, description, created_at "
            "FROM project_files ORDER BY created_at DESC LIMIT 200"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        files = [{'id': r[0], 'file_name': r[1], 'file_type': r[2], 'file_size': r[3],
                  'cdn_url': r[4], 'description': r[5], 'created_at': str(r[6])} for r in rows]
        print(f"[files] GET -> {len(files)} files")
        return ok({'files': files})

    if method == 'POST':
        raw_body = event.get('body') or ''
        print(f"[files] POST body_len={len(raw_body)}")
        if not raw_body:
            return err('empty body')

        body = json.loads(raw_body)
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type') or 'application/octet-stream'
        description = body.get('description') or ''
        content_b64 = body.get('content_base64') or ''
        print(f"[files] file={file_name} b64_len={len(content_b64)}")

        raw_bytes = base64.b64decode(content_b64)
        file_size = len(raw_bytes)
        print(f"[files] decoded {file_size} bytes")

        access_key = os.environ['AWS_ACCESS_KEY_ID']
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=access_key,
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        key = f"uploads/{uuid.uuid4().hex}_{file_name}"
        s3.put_object(Bucket='files', Key=key, Body=raw_bytes, ContentType=file_type)
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        print(f"[files] S3 ok -> {cdn_url}")

        fn = file_name.replace("'", "''")
        ft = file_type.replace("'", "''")
        fu = cdn_url.replace("'", "''")
        fd = description.replace("'", "''")
        cur.execute(
            f"INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) "
            f"VALUES ('{fn}', '{ft}', {file_size}, '{fu}', '{fd}') RETURNING id"
        )
        new_id = cur.fetchone()[0]
        cur.close(); conn.close()
        print(f"[files] DB saved id={new_id}")
        return ok({'id': new_id, 'cdn_url': cdn_url, 'file_size': file_size})

    if method == 'DELETE':
        params = event.get('queryStringParameters') or {}
        file_id = int(params.get('id', '0'))
        cur.execute(f"DELETE FROM project_files WHERE id = {file_id}")
        cur.close(); conn.close()
        return ok({'deleted': file_id})

    cur.close(); conn.close()
    return err('method not allowed', 405)
