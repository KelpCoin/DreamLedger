import hashlib
import json
import os
import re
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
REPOS = [x.strip() for x in os.environ.get('RAG_GITHUB_REPOS', 'KelpCoin/DreamLedger').split(',') if x.strip()]
CHUNK_CHARS = int(os.environ.get('RAG_CHUNK_CHARS', '3500'))
MAX_FILES = int(os.environ.get('RAG_MAX_FILES', '1000'))
EMBED_URL = os.environ.get('RAG_EMBEDDING_URL', '').rstrip('/')
EMBED_MODEL = os.environ.get('RAG_EMBEDDING_MODEL', '')
EMBED_KEY = os.environ.get('RAG_EMBEDDING_API_KEY', os.environ.get('OPENAI_API_KEY', ''))

SKIP_DIRS = {'.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.venv', '__pycache__'}
TEXT_EXTS = {'.md','.mdx','.txt','.json','.jsonl','.js','.cjs','.mjs','.ts','.tsx','.jsx','.py','.ps1','.psm1','.yml','.yaml','.toml','.sql','.sh','.css','.html','.xml'}
SECRET_WORDS = re.compile(r'(secret|password|private.?key|api.?key|access.?token|service.?role)', re.I)


def request_json(url, method='GET', body=None, headers=None):
    h = {'Accept': 'application/vnd.github+json', 'User-Agent': 'DreamLedger-RAG/1.0'}
    if GITHUB_TOKEN:
        h['Authorization'] = 'Bearer ' + GITHUB_TOKEN
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    if data is not None:
        h['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def chunks(text):
    text = text.replace('\r\n', '\n').strip()
    if len(text) <= CHUNK_CHARS:
        return [text]
    out, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_CHARS, len(text))
        if end < len(text):
            cut = text.rfind('\n', start, end)
            if cut > start + CHUNK_CHARS // 2:
                end = cut
        part = text[start:end].strip()
        if part:
            out.append(part)
        start = end
    return out


def embedding(text):
    if not EMBED_URL or not EMBED_MODEL:
        return None
    headers = {'Content-Type': 'application/json'}
    if EMBED_KEY:
        headers['Authorization'] = 'Bearer ' + EMBED_KEY
    req = urllib.request.Request(EMBED_URL, data=json.dumps({'model': EMBED_MODEL, 'input': text}).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())['data'][0]['embedding']


def supabase(path, method='POST', body=None, upsert=False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    prefer = 'resolution=merge-duplicates,return=minimal' if upsert else 'return=minimal'
    headers = {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': prefer}
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(SUPABASE_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def list_tree(repo):
    branch = request_json(f'https://api.github.com/repos/{repo}').get('default_branch', 'main')
    data = request_json(f'https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1')
    return branch, data.get('tree', [])


def fetch_file(repo, path, ref):
    data = request_json(f'https://api.github.com/repos/{repo}/contents/{urllib.parse.quote(path, safe="/")}?ref={urllib.parse.quote(ref)}')
    if data.get('encoding') != 'base64':
        return None
    import base64
    return base64.b64decode(data['content']).decode('utf-8', errors='replace')


def ingest_repo(repo):
    branch, tree = list_tree(repo)
    count = 0
    for item in tree:
        if count >= MAX_FILES:
            break
        path = item.get('path', '')
        if item.get('type') != 'blob' or any(p in SKIP_DIRS for p in path.split('/')):
            continue
        ext = os.path.splitext(path)[1].lower()
        if ext not in TEXT_EXTS or SECRET_WORDS.search(os.path.basename(path)):
            continue
        try:
            content = fetch_file(repo, path, branch)
            if not content or len(content) > 500000:
                continue
            doc_sha = item.get('sha', '')
            source_uri = f'https://github.com/{repo}/blob/{branch}/{path}'
            document = {
                'source_system': 'github', 'source_type': 'repository_file', 'source_uri': source_uri,
                'source_path': path, 'source_sha256': doc_sha, 'observed_at': datetime.now(timezone.utc).isoformat(),
                'title': path, 'content': content, 'metadata': {'repository': repo, 'branch': branch},
                'content_sha256': sha256(content), 'status': 'ACTIVE'
            }
            supabase('/rest/v1/rag/documents?on_conflict=source_system,source_uri,content_sha256', 'POST', document, upsert=True)
            docs = supabase('/rest/v1/rag/documents?select=id&source_system=eq.github&source_uri=eq.' + urllib.parse.quote(source_uri, safe='') + '&content_sha256=eq.' + document['content_sha256'], 'GET')
            if not docs:
                raise RuntimeError('document insert lookup failed for ' + path)
            doc_id = docs[0]['id']
            for idx, part in enumerate(chunks(content)):
                chunk = {'document_id': doc_id, 'chunk_index': idx, 'content': part, 'content_sha256': sha256(part), 'token_estimate': max(1, len(part)//4), 'metadata': {'repository': repo, 'branch': branch}}
                emb = embedding(part)
                if emb is not None:
                    if len(emb) != 384:
                        raise RuntimeError(f'embedding dimension {len(emb)} != 384')
                    chunk['embedding'] = emb
                supabase('/rest/v1/rag/chunks?on_conflict=document_id,chunk_index', 'POST', chunk, upsert=True)
            count += 1
            print(f'INGESTED {repo}:{path}')
        except Exception as exc:
            print(f'SKIP {repo}:{path}: {exc}', file=sys.stderr)
    return count


if __name__ == '__main__':
    total = sum(ingest_repo(repo) for repo in REPOS)
    print(json.dumps({'status':'PASS','repositories':REPOS,'documents_ingested':total}, indent=2))
