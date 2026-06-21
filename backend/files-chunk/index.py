import json
import os
import base64
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


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def handler(event: dict, context) -> dict:
    '''
    Multipart upload чанков в S3.
    action=init   -> создать multipart upload, вернуть upload_id + key
    action=chunk  -> загрузить часть (part_number, upload_id, key, content_base64)
    action=finish -> завершить (upload_id, key, parts=[{part_number, etag}])
    action=abort  -> отменить (upload_id, key)
    '''
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if method != 'POST':
        return err('only POST', 405)

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    s3 = get_s3()
    access_key = os.environ['AWS_ACCESS_KEY_ID']

    if action == 'init':
        file_name = (body.get('file_name') or 'file').replace('/', '_')
        file_type = body.get('file_type') or 'application/octet-stream'
        import uuid
        key = f"uploads/{uuid.uuid4().hex}_{file_name}"
        resp = s3.create_multipart_upload(Bucket='files', Key=key, ContentType=file_type)
        upload_id = resp['UploadId']
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        print(f"[chunk] init key={key} upload_id={upload_id}")
        return ok({'upload_id': upload_id, 'key': key, 'cdn_url': cdn_url})

    if action == 'chunk':
        upload_id = body.get('upload_id')
        key = body.get('key')
        part_number = int(body.get('part_number', 1))
        content_b64 = body.get('content_base64') or ''
        raw = base64.b64decode(content_b64)
        print(f"[chunk] part {part_number} size={len(raw)} upload_id={upload_id}")
        resp = s3.upload_part(
            Bucket='files', Key=key,
            UploadId=upload_id, PartNumber=part_number, Body=raw
        )
        etag = resp['ETag']
        return ok({'part_number': part_number, 'etag': etag})

    if action == 'finish':
        upload_id = body.get('upload_id')
        key = body.get('key')
        parts = body.get('parts', [])
        print(f"[chunk] finish upload_id={upload_id} parts={len(parts)}")
        s3.complete_multipart_upload(
            Bucket='files', Key=key, UploadId=upload_id,
            MultipartUpload={'Parts': [{'PartNumber': p['part_number'], 'ETag': p['etag']} for p in parts]}
        )
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
        return ok({'cdn_url': cdn_url})

    if action == 'abort':
        upload_id = body.get('upload_id')
        key = body.get('key')
        s3.abort_multipart_upload(Bucket='files', Key=key, UploadId=upload_id)
        print(f"[chunk] aborted upload_id={upload_id}")
        return ok({'aborted': True})

    return err(f'unknown action: {action}')
