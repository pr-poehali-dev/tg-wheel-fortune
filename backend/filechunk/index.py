import json
import os
import uuid
import psycopg2
import boto3
from botocore.config import Config

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


def get_db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
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
        config=Config(signature_version='s3v4'),
    )


def handler(event: dict, context) -> dict:
    '''
    Загрузка файлов через S3 Presigned URL.
    action=presign -> вернуть presigned PUT URL для загрузки напрямую в S3
    action=confirm -> сохранить запись в БД после успешной загрузки
    '''
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    if method != 'POST':
        return err('only POST', 405)

    try:
        body = json.loads(event.get('body') or '{}')
        action = body.get('action')
        print(f"[filechunk] action={action}")

        s3 = get_s3()
        access_key = os.environ['AWS_ACCESS_KEY_ID']

        if action == 'presign':
            file_name = (body.get('file_name') or 'file').replace('/', '_').replace('\\', '_')
            file_type = body.get('file_type') or 'application/octet-stream'
            s3_key = f"uploads/{uuid.uuid4().hex}_{file_name}"

            presigned_url = s3.generate_presigned_url(
                'put_object',
                Params={'Bucket': 'files', 'Key': s3_key, 'ContentType': file_type},
                ExpiresIn=3600,
            )
            cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{s3_key}"
            print(f"[filechunk] presign ok key={s3_key}")
            return ok({'presigned_url': presigned_url, 'cdn_url': cdn_url, 's3_key': s3_key})

        if action == 'confirm':
            file_name = body.get('file_name') or 'file'
            file_type = body.get('file_type') or 'application/octet-stream'
            file_size = int(body.get('file_size') or 0)
            cdn_url = body.get('cdn_url') or ''
            description = body.get('description') or ''

            conn, cur = get_db()
            cur.execute(
                "INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (file_name, file_type, file_size, cdn_url, description)
            )
            new_id = cur.fetchone()[0]
            cur.close(); conn.close()
            print(f"[filechunk] confirmed id={new_id} cdn={cdn_url}")
            return ok({'id': new_id, 'cdn_url': cdn_url})

        return err(f'unknown action: {action}')

    except Exception as e:
        import traceback
        print(f"[filechunk] ERROR: {traceback.format_exc()}")
        return err(f'server error: {e}', 500)
