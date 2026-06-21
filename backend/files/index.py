import json
import os
import uuid
import psycopg2
import boto3
from botocore.config import Config


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}
JSON = {'Content-Type': 'application/json'}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4'),
    )


def get_db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE IF NOT EXISTS project_files ("
        "id SERIAL PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT, "
        "file_size BIGINT DEFAULT 0, s3_key TEXT, cdn_url TEXT NOT NULL, "
        "description TEXT DEFAULT '', created_at TIMESTAMP DEFAULT now())"
    )
    return conn, cur


def ok(data):
    return {'statusCode': 200, 'headers': {**CORS, **JSON}, 'body': json.dumps(data)}


def handler(event: dict, context) -> dict:
    '''Файлообменник: presigned upload URL, список файлов, регистрация, удаление.'''
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    # POST /presign — выдать presigned URL для прямой загрузки в S3
    if method == 'POST' and path.endswith('/presign'):
        body = json.loads(event.get('body') or '{}')
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type') or 'application/octet-stream'
        key = f"uploads/{uuid.uuid4().hex}_{file_name}"
        s3 = get_s3()
        presigned = s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': 'files', 'Key': key, 'ContentType': file_type},
            ExpiresIn=600,
        )
        access_key = os.environ['AWS_ACCESS_KEY_ID']
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        return ok({'presigned_url': presigned, 's3_key': key, 'cdn_url': cdn_url})

    # POST /register — зарегистрировать файл в БД после загрузки
    if method == 'POST' and path.endswith('/register'):
        body = json.loads(event.get('body') or '{}')
        file_name = (body.get('file_name') or 'file').replace("'", "''")
        file_type = (body.get('file_type') or '').replace("'", "''")
        file_size = int(body.get('file_size') or 0)
        cdn_url = body.get('cdn_url', '').replace("'", "''")
        s3_key = body.get('s3_key', '').replace("'", "''")
        description = (body.get('description') or '').replace("'", "''")
        conn, cur = get_db()
        cur.execute(
            f"INSERT INTO project_files (file_name, file_type, file_size, s3_key, cdn_url, description) "
            f"VALUES ('{file_name}', '{file_type}', {file_size}, '{s3_key}', '{cdn_url}', '{description}') RETURNING id"
        )
        new_id = cur.fetchone()[0]
        cur.close(); conn.close()
        return ok({'id': new_id, 'cdn_url': cdn_url})

    # GET — список файлов
    if method == 'GET':
        conn, cur = get_db()
        cur.execute(
            "SELECT id, file_name, file_type, file_size, cdn_url, description, created_at "
            "FROM project_files ORDER BY created_at DESC LIMIT 200"
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        files = [{
            'id': r[0], 'file_name': r[1], 'file_type': r[2], 'file_size': r[3],
            'cdn_url': r[4], 'description': r[5], 'created_at': str(r[6]),
        } for r in rows]
        return ok({'files': files})

    # DELETE ?id=X
    if method == 'DELETE':
        params = event.get('queryStringParameters') or {}
        file_id = int(params.get('id', '0'))
        conn, cur = get_db()
        cur.execute(f"DELETE FROM project_files WHERE id = {file_id}")
        cur.close(); conn.close()
        return ok({'deleted': file_id})

    return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'method not allowed'})}
