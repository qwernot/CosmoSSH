import urllib.request
import urllib.error
import json
import os

TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', 'YOUR_CLOUDFLARE_API_TOKEN')
ACCOUNT_ID = os.environ.get('CLOUDFLARE_ACCOUNT_ID', 'YOUR_CLOUDFLARE_ACCOUNT_ID')
SCRIPT_NAME = 'cosmossh-sync'
KV_TITLE = 'cosmossh_data'

headers = {
    'Authorization': f'Bearer {TOKEN}',
}

def make_request(url, method='GET', data=None, content_type='application/json'):
    req_headers = dict(headers)
    if content_type:
        req_headers['Content-Type'] = content_type
    req_data = None
    if data is not None:
        if isinstance(data, (dict, list)):
            req_data = json.dumps(data).encode('utf-8')
        elif isinstance(data, (bytes, bytearray)):
            req_data = data
        else:
            req_data = str(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"HTTP {e.code} Error for {method} {url}: {err_body}")
        raise RuntimeError(err_body)

# 1. Check or create KV Namespace
print("[1/4] Checking KV Namespace...")
kv_list = make_request(f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces')
kv_id = None
for kv in kv_list.get('result', []):
    if kv.get('title') == KV_TITLE:
        kv_id = kv['id']
        print(f"Found existing KV Namespace '{KV_TITLE}' -> ID: {kv_id}")
        break

if not kv_id:
    print(f"Creating new KV Namespace '{KV_TITLE}'...")
    created = make_request(
        f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/storage/kv/namespaces',
        method='POST',
        data={'title': KV_TITLE}
    )
    kv_id = created['result']['id']
    print(f"Created KV Namespace '{KV_TITLE}' -> ID: {kv_id}")

# 2. Read worker code
print("[2/4] Reading worker.js...")
worker_path = os.path.join(os.path.dirname(__file__), '../cloudflare-sync-worker/worker.js')
with open(worker_path, 'r', encoding='utf-8') as f:
    worker_code = f.read()

# 3. Upload Worker with KV binding using multipart/form-data
print("[3/4] Uploading and deploying Worker to Cloudflare...")
boundary = '----CloudflareWorkerBoundary' + os.urandom(8).hex()

metadata = {
    'main_module': 'worker.js',
    'compatibility_date': '2024-01-01',
    'bindings': [
        {
            'name': 'COSMOSSH_KV',
            'type': 'kv_namespace',
            'namespace_id': kv_id
        }
    ]
}

body_parts = []
# Part 1: Metadata
body_parts.append(f'--{boundary}\r\n'.encode('utf-8'))
body_parts.append(b'Content-Disposition: form-data; name="metadata"\r\n')
body_parts.append(b'Content-Type: application/json\r\n\r\n')
body_parts.append(json.dumps(metadata).encode('utf-8'))
body_parts.append(b'\r\n')

# Part 2: worker.js
body_parts.append(f'--{boundary}\r\n'.encode('utf-8'))
body_parts.append(b'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n')
body_parts.append(b'Content-Type: application/javascript+module\r\n\r\n')
body_parts.append(worker_code.encode('utf-8'))
body_parts.append(b'\r\n')

# Close
body_parts.append(f'--{boundary}--\r\n'.encode('utf-8'))
multipart_body = b''.join(body_parts)

upload_res = make_request(
    f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}',
    method='PUT',
    data=multipart_body,
    content_type=f'multipart/form-data; boundary={boundary}'
)
print("Worker script deployed successfully!")

# 4. Enable workers.dev subdomain route
print("[4/4] Enabling workers.dev route...")
subdomain_res = make_request(
    f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{SCRIPT_NAME}/subdomain',
    method='POST',
    data={'enabled': True}
)

# Fetch subdomain name
sub_info = make_request(f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/subdomain')
subname = sub_info['result']['subdomain']
worker_url = f'https://{SCRIPT_NAME}.{subname}.workers.dev'

print("\n==========================================")
print("  🎉 Cloudflare Worker 部署成功!")
print("==========================================")
print(f"Worker 服务地址: {worker_url}")
print(f"KV 数据库 ID:   {kv_id}")
print(f"绑定变量:       COSMOSSH_KV")
print("==========================================\n")
