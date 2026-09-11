#!/usr/bin/env python3
from __future__ import print_function
import json, os, sys, urllib.request

def get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.getcode(), r.read().decode('utf-8', 'replace')

def main():
    base = os.environ.get('BRIDGE_BASE_URL', 'https://dreamledger.org').rstrip('/')
    token = os.environ.get('DREAMLEDGER_AGENT_BRIDGE_TOKEN', '')
    report = {'schema': 'browneye/local-health/v1', 'checks': []}
    ok = True
    for name, path, need_token in [('healthz', '/healthz', False), ('version', '/version', False), ('manifest', '/api/agent-bridge/manifest', True)]:
        try:
            headers = {'x-dreamledger-agent-token': token} if (need_token and token) else {}
            code, body = get(base + path, headers=headers)
            report['checks'].append({'name': name, 'status': 'PASS' if code == 200 else 'FAIL', 'code': code, 'snippet': body[:200]})
            ok = ok and code == 200
        except Exception as e:
            report['checks'].append({'name': name, 'status': 'FAIL', 'error': str(e)})
            ok = False
    report['overall'] = 'PASS' if ok else 'FAIL'
    print(json.dumps(report, indent=2))
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
