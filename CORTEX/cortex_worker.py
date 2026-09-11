#!/usr/bin/env python3
from __future__ import print_function
import argparse, hashlib, json, os, sys, time, urllib.request, urllib.error

def http_json(method, url, headers=None, body=None, timeout=30):
    data = None if body is None else json.dumps(body).encode('utf-8')
    h = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode('utf-8', 'replace')
            return r.getcode(), json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {'raw': raw}
        return e.code, payload

def sha256_text(s):
    return hashlib.sha256((s or '').encode('utf-8')).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--config', required=True)
    args = ap.parse_args()
    cfg = json.load(open(args.config))
    manifest = json.load(open(args.manifest))
    token = os.environ.get(cfg.get('bridge_token_env', 'DREAMLEDGER_AGENT_BRIDGE_TOKEN'), '')
    if not token:
        print(json.dumps({'error': 'missing bridge token env'}))
        return 2
    base = cfg['bridge_base_url'].rstrip('/')
    agent = cfg.get('agent_id', 'cortex-windows-1')
    headers = {'x-dreamledger-agent-token': token, 'X-Correlation-ID': manifest.get('correlation_id', '')}
    results = []
    for job in manifest.get('jobs', []):
        entry = {'job_id': job.get('job_id'), 'capability': job.get('capability'), 'status': 'FAILED'}
        if job.get('action') == 'bridge_claim_smoke':
            code, body = http_json('POST', base + '/api/agent-bridge/jobs/claim', headers=headers, body={'worker_id': agent, 'lease_seconds': 30})
            entry.update({'http_status': code, 'response': body, 'status': 'COMPLETED' if code in (200, 204) else 'FAILED', 'output_hash': sha256_text(json.dumps(body, sort_keys=True))})
        elif job.get('action') == 'manifest_probe':
            code, body = http_json('GET', base + '/api/agent-bridge/manifest', headers=headers)
            entry.update({'http_status': code, 'response': body, 'status': 'COMPLETED' if code == 200 else 'FAILED', 'output_hash': sha256_text(json.dumps(body, sort_keys=True))})
        else:
            entry['error'] = 'unsupported local action'
        results.append(entry)
    out = {'schema': 'browneye/cortex-execution-result/v1', 'agent_id': agent, 'manifest_id': manifest.get('manifest_id'), 'results': results}
    out_path = cfg.get('paths', {}).get('result', 'cortex_execution_result.json')
    json.dump(out, open(out_path, 'w'), indent=2)
    print(json.dumps(out, indent=2))
    return 0 if all(r.get('status') == 'COMPLETED' for r in results) else 1

if __name__ == '__main__':
    sys.exit(main())
