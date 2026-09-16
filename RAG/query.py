import json
import os
import sys
import urllib.request

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
EMBED_URL = os.environ.get('RAG_EMBEDDING_URL', '').rstrip('/')
EMBED_MODEL = os.environ.get('RAG_EMBEDDING_MODEL', '')
EMBED_KEY = os.environ.get('RAG_EMBEDDING_API_KEY', os.environ.get('OPENAI_API_KEY', ''))


def embedding(text):
    if not EMBED_URL or not EMBED_MODEL:
        return None
    headers = {'Content-Type': 'application/json'}
    if EMBED_KEY:
        headers['Authorization'] = 'Bearer ' + EMBED_KEY
    req = urllib.request.Request(EMBED_URL, data=json.dumps({'model': EMBED_MODEL, 'input': text}).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        vec = json.loads(r.read().decode())['data'][0]['embedding']
    if len(vec) != 384:
        raise RuntimeError(f'embedding dimension {len(vec)} != 384')
    return vec


def query(text, count=8):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    vec = embedding(text)
    body = {'query_text': text, 'match_count': count, 'rrf_k': 50}
    if vec is not None:
        body['query_embedding'] = vec
    headers = {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json'}
    req = urllib.request.Request(SUPABASE_URL + '/rest/v1/rpc/rag_hybrid_search', data=json.dumps(body).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


if __name__ == '__main__':
    q = ' '.join(sys.argv[1:]).strip()
    if not q:
        raise SystemExit('usage: python RAG/query.py <question>')
    print(json.dumps({'query': q, 'results': query(q)}, indent=2))
