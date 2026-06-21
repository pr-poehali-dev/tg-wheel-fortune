import json
import os
import base64
import uuid
import traceback
import psycopg2
import boto3
# v2: chunks stored in S3, tables managed via migrations

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
    return conn, cur


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def handler(event: dict, context) -> dict:
    '''
    Чанковая загрузка файлов до 200 МБ.
    Каждый чанк сразу пишется в S3 отдельным объектом (без хранения в БД/памяти).
    finish — склеивает чанки в итоговый файл и чистит временные.
    action=init   -> создать сессию
    action=chunk  -> записать часть в S3 (session_id, chunk_index, content_base64)
    action=finish -> склеить части в итоговый файл, записать в project_files
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
        conn, cur = get_db()

        if action == 'init':
            session_id = uuid.uuid4().hex
            file_name = (body.get('file_name') or 'file').replace('/', '_').replace('\\', '_')
            file_type = body.get('file_type') or 'application/octet-stream'
            total_chunks = int(body.get('total_chunks') or 1)
            description = body.get('description') or ''
            prefix = f"tmp/{session_id}"
            cur.execute(
                "INSERT INTO upload_sessions (session_id, file_name, file_type, total_chunks, description, prefix) "
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (session_id, file_name, file_type, total_chunks, description, prefix)
            )
            cur.close(); conn.close()
            print(f"[filechunk] init session={session_id} total={total_chunks}")
            return ok({'session_id': session_id})

        if action == 'chunk':
            session_id = body.get('session_id')
            chunk_index = int(body.get('chunk_index', 0))
            raw = base64.b64decode(body.get('content_base64') or '')

            cur.execute("SELECT prefix FROM upload_sessions WHERE session_id=%s", (session_id,))
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close()
                return err('session not found')
            prefix = row[0]
            chunk_key = f"{prefix}/{chunk_index:05d}"

            s3.put_object(Bucket='files', Key=chunk_key, Body=raw)
            cur.execute(
                "INSERT INTO upload_chunk_keys (session_id, chunk_index, s3_key) VALUES (%s,%s,%s) "
                "ON CONFLICT (session_id, chunk_index) DO UPDATE SET s3_key=EXCLUDED.s3_key",
                (session_id, chunk_index, chunk_key)
            )
            cur.close(); conn.close()
            print(f"[filechunk] chunk {chunk_index} -> S3 ({len(raw)} bytes)")
            return ok({'received': chunk_index})

        if action == 'finish':
            session_id = body.get('session_id')
            print(f"[filechunk] finish session={session_id}")

            cur.execute(
                "SELECT file_name, file_type, total_chunks, description, prefix FROM upload_sessions WHERE session_id=%s",
                (session_id,)
            )
            row = cur.fetchone()
            if not row:
                cur.close(); conn.close()
                return err('session not found')
            file_name, file_type, total_chunks, description, prefix = row

            cur.execute(
                "SELECT chunk_index, s3_key FROM upload_chunk_keys WHERE session_id=%s ORDER BY chunk_index",
                (session_id,)
            )
            chunk_rows = cur.fetchall()
            print(f"[filechunk] chunks: {len(chunk_rows)}/{total_chunks}")
            if len(chunk_rows) != total_chunks:
                cur.close(); conn.close()
                return err(f'получено {len(chunk_rows)} из {total_chunks} частей')

            # Читаем чанки из S3 по порядку и склеиваем
            buf = bytearray()
            for _, chunk_key in chunk_rows:
                obj = s3.get_object(Bucket='files', Key=chunk_key)
                buf.extend(obj['Body'].read())
            file_size = len(buf)
            print(f"[filechunk] assembled {file_size} bytes, uploading final...")

            final_key = f"uploads/{uuid.uuid4().hex}_{file_name}"
            s3.put_object(Bucket='files', Key=final_key, Body=bytes(buf), ContentType=file_type)
            cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{final_key}"
            print(f"[filechunk] final S3 ok -> {cdn_url}")

            # Чистим временные чанки
            for _, chunk_key in chunk_rows:
                try:
                    s3.delete_object(Bucket='files', Key=chunk_key)
                except Exception:
                    pass

            cur.execute(
                "INSERT INTO project_files (file_name, file_type, file_size, cdn_url, description) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (file_name, file_type, file_size, cdn_url, description)
            )
            new_id = cur.fetchone()[0]
            cur.execute("DELETE FROM upload_chunk_keys WHERE session_id=%s", (session_id,))
            cur.execute("DELETE FROM upload_sessions WHERE session_id=%s", (session_id,))
            cur.close(); conn.close()
            print(f"[filechunk] done id={new_id}")
            return ok({'id': new_id, 'cdn_url': cdn_url, 'file_size': file_size})

        cur.close(); conn.close()
        return err(f'unknown action: {action}')

    except Exception as e:
        print(f"[filechunk] ERROR: {traceback.format_exc()}")
        return err(f'server error: {e}', 500)