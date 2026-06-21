import json
import os
import base64
import uuid
import psycopg2
import boto3


def handler(event: dict, context) -> dict:
    '''
    Файлообменник: загрузка файлов в S3 и хранение метаданных в БД.
    GET - список загруженных файлов; POST - загрузка нового файла (base64 в body).
    '''
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        "CREATE TABLE IF NOT EXISTS project_files ("
        "id SERIAL PRIMARY KEY, file_name TEXT NOT NULL, file_type TEXT, "
        "file_size BIGINT DEFAULT 0, cdn_url TEXT NOT NULL, "
        "description TEXT DEFAULT '', created_at TIMESTAMP DEFAULT now())"
    )

    if method == 'GET':
        cur.execute(
            "SELECT id, file_name, file_type, file_size, cdn_url, description, created_at "
            "FROM project_files ORDER BY created_at DESC LIMIT 200"
        )
        rows = cur.fetchall()
        files = [{
            'id': r[0], 'file_name': r[1], 'file_type': r[2], 'file_size': r[3],
            'cdn_url': r[4], 'description': r[5], 'created_at': str(r[6]),
        } for r in rows]
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps({'files': files}),
        }

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type', 'application/octet-stream')
        description = body.get('description', '')
        content_b64 = body.get('content_base64', '')

        raw = base64.b64decode(content_b64) if content_b64 else b''
        file_size = len(raw)

        access_key = os.environ['AWS_ACCESS_KEY_ID']
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=access_key,
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        key = f"uploads/{uuid.uuid4().hex}_{file_name}"
        s3.put_object(Bucket='files', Key=key, Body=raw, ContentType=file_type)
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"

        safe_name = file_name.replace("'", "''")
        safe_type = file_type.replace("'", "''")
        safe_url = cdn_url.replace("'", "''")
        safe_desc = description.replace("'", "''")
        cur.execute(
            f"INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) "
            f"VALUES ('{safe_name}', '{safe_type}', {file_size}, '{safe_url}', '{safe_desc}') RETURNING id"
        )
        new_id = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps({'id': new_id, 'cdn_url': cdn_url, 'file_size': file_size}),
        }

    if method == 'DELETE':
        params = event.get('queryStringParameters') or {}
        file_id = int(params.get('id', '0'))
        cur.execute(f"DELETE FROM project_files WHERE id = {file_id}")
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {**cors, 'Content-Type': 'application/json'},
            'body': json.dumps({'deleted': file_id}),
        }

    cur.close()
    conn.close()
    return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'error': 'method not allowed'})}