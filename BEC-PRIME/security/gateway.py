import json
import os
import sys
import uuid
import hashlib
from datetime import datetime, timezone, timedelta

ROOT = os.environ.get('BECKPRIME_ROOT', os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
SECURITY_ROOT = os.path.join(ROOT, 'security')
MANIFEST_PATH = os.path.join(SECURITY_ROOT, 'mcp-gateway-manifest.json')
POLICY_PATH = os.path.join(SECURITY_ROOT, 'mcp-gateway-policy.json')
LEDGER_PATH = os.path.join(ROOT, 'data', 'proofs', 'mcp-gateway-events.jsonl')
PROOF_DIR = os.path.join(ROOT, 'data', 'proofs')

PROTOCOL_VERSION = '2025-11-25'
EXPECTED_TOOLS = {
    'dl_read_cartridge': 'READ_ONLY',
    'dl_read_inventory': 'READ_ONLY',
    'dl_read_ledger': 'READ_ONLY',
    'dl_propose_offer': 'PROPOSAL_ONLY',
    'dl_verify_proof': 'READ_ONLY',
    'dl_propose_checkout': 'PROPOSAL_ONLY',
}

client_identity = None
initialized = False
call_count = 0
MAX_CALLS = 100
MAX_MESSAGE_BYTES = 262144


def now():
    return datetime.now(timezone.utc).isoformat()


def canonical_manifest(m):
    body = {
        'schema_version': m['schema_version'],
        'gateway': m['gateway'],
        'transport': m['transport'],
        'protocol_version': m['protocol_version'],
        'tools': m['tools'],
    }
    return json.dumps(body, indent=2) + '\n'


def sha256_text(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def verify_manifest():
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        m = json.load(f)
    if m.get('transport') != 'stdio':
        raise RuntimeError('MCP transport policy violation')
    if m.get('protocol_version') != PROTOCOL_VERSION:
        raise RuntimeError('Protocol version mismatch')
    if sha256_text(canonical_manifest(m)) != m.get('manifest_hash'):
        raise RuntimeError('Tool manifest hash mismatch')
    tools = m.get('tools', [])
    if len(tools) != len(EXPECTED_TOOLS):
        raise RuntimeError('Tool allowlist size mismatch')
    for t in tools:
        if t.get('name') not in EXPECTED_TOOLS:
            raise RuntimeError('Unapproved tool')
        if t.get('permission') != EXPECTED_TOOLS[t['name']]:
            raise RuntimeError('Tool permission mismatch')
    if any(x not in EXPECTED_TOOLS for x in [t['name'] for t in tools]):
        raise RuntimeError('Tool shadowing detected')
    return m


def append_event(event_type, payload):
    os.makedirs(os.path.dirname(LEDGER_PATH), exist_ok=True)
    previous = '0' * 64
    if os.path.exists(LEDGER_PATH):
        with open(LEDGER_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    previous = json.loads(line)['event_hash']
    event = {
        'event_id': 'MCP-EVT-' + str(uuid.uuid4()),
        'event_type': event_type,
        'timestamp': now(),
        'payload': payload,
        'previous_hash': previous,
    }
    raw = json.dumps(event, sort_keys=True, separators=(',', ':'))
    event['event_hash'] = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    with open(LEDGER_PATH, 'a', encoding='utf-8') as f:
        f.write(json.dumps(event, sort_keys=True) + '\n')
    return event


def verify_proof(proof_id):
    if not proof_id or '/' in proof_id or '\\' in proof_id or '..' in proof_id:
        return {'verified': False, 'reason': 'Invalid proof id'}
    path = os.path.join(PROOF_DIR, proof_id + '.json')
    if not os.path.isfile(path):
        return {'verified': False, 'reason': 'Proof not found'}
    with open(path, 'r', encoding='utf-8') as f:
        proof = json.load(f)
    if 'data' not in proof or 'hash' not in proof:
        return {'verified': False, 'reason': 'Proof hash missing'}
    computed = sha256_text(json.dumps(proof['data'], sort_keys=True, separators=(',', ':')))
    return {'proof_id': proof_id, 'verified': computed == proof['hash'], 'computed_hash': computed}


def court(proposal):
    silo = proposal.get('silo', 'CORE')
    if silo not in ('CORE', 'MTG', 'DREAMIEZ'):
        return {'decision': 'BLOCKED', 'reason': ['Unknown silo'], 'approved': False}
    if proposal.get('type') not in ('OFFER', 'CHECKOUT'):
        return {'decision': 'BLOCKED', 'reason': ['Unsupported proposal type'], 'approved': False}
    if proposal.get('type') == 'CHECKOUT':
        amount = float(proposal.get('checkout', {}).get('amount', 0))
        if amount <= 0:
            return {'decision': 'BLOCKED', 'reason': ['Amount must be positive'], 'approved': False}
    return {
        'decision': 'ELIGIBLE_FOR_HUMAN_APPROVAL',
        'approved': False,
        'requires_human_approval': True,
        'reason': ['Model proposals require human approval'],
        'capital_authority': 'ZERO',
    }


def tool_call(name, args):
    if name not in EXPECTED_TOOLS:
        raise ValueError('Tool not found')
    silo = args.get('silo', 'CORE')
    if silo not in ('CORE', 'MTG', 'DREAMIEZ'):
        return {'error': 'Silo access denied'}
    if EXPECTED_TOOLS[name] == 'PROPOSAL_ONLY':
        if name == 'dl_propose_offer':
            offer = args.get('offer', {})
            if not offer.get('sku') or float(offer.get('price', 0)) <= 0:
                return {'error': 'Invalid offer'}
            c = court({'type': 'OFFER', 'offer': offer, 'silo': silo})
            proposal = {'proposal_id': 'OFFER-' + str(uuid.uuid4()), 'status': 'AWAITING_HUMAN_APPROVAL', 'silo': silo, 'offer': offer, 'court': c, 'capital_authority': 'ZERO', 'executed': False}
            append_event('OFFER_PROPOSED', proposal)
            return proposal
        checkout = args.get('checkout', {})
        if not checkout.get('sku') or float(checkout.get('amount', 0)) <= 0 or not checkout.get('customer_ref'):
            return {'error': 'Invalid checkout'}
        c = court({'type': 'CHECKOUT', 'checkout': checkout, 'silo': silo})
        proposal = {'checkout_id': 'CHECKOUT-' + str(uuid.uuid4()), 'status': 'AWAITING_HUMAN_APPROVAL', 'silo': silo, 'checkout': checkout, 'court': c, 'capital_authority': 'ZERO', 'execution': 'BLOCKED', 'executed': False}
        append_event('CHECKOUT_PROPOSED', proposal)
        return proposal
    if name == 'dl_verify_proof':
        return verify_proof(args.get('proof_id', ''))
    if name == 'dl_read_ledger':
        if not os.path.exists(LEDGER_PATH):
            return {'entries': [], 'count': 0, 'read_only': True}
        entries = []
        with open(LEDGER_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
        return {'entries': entries[-min(int(args.get('limit', 100)), 100):], 'read_only': True}
    if name == 'dl_read_cartridge':
        sku = str(args.get('sku', ''))
        if not sku or '..' in sku or '/' in sku or '\\' in sku:
            return {'error': 'Invalid SKU'}
        path = os.path.join(ROOT, 'catalog', 'products', sku + '.json')
        if not os.path.isfile(path):
            return {'error': 'Not found'}
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if silo != 'CORE' and data.get('silo', 'CORE') != silo:
            return {'error': 'Silo access denied'}
        data.pop('internal_notes', None)
        return {'sku': sku, 'cartridge': data, 'read_only': True}
    if name == 'dl_read_inventory':
        path = os.path.join(ROOT, 'catalog', 'products', 'inventory.json')
        if not os.path.isfile(path):
            return {'error': 'Inventory not found'}
        with open(path, 'r', encoding='utf-8') as f:
            inv = json.load(f)
        if silo != 'CORE':
            inv = {k: v for k, v in inv.items() if v.get('silo', 'CORE') == silo}
        return {'inventory': inv, 'read_only': True}
    return {'error': 'Unhandled tool'}


def response(req, result=None, error=None):
    out = {'jsonrpc': '2.0'}
    if error is not None:
        out['error'] = error
    else:
        out['result'] = result
    if 'id' in req:
        out['id'] = req['id']
    return out


def handle(req):
    global initialized, client_identity, call_count
    method = req.get('method', '')
    params = req.get('params') or {}
    if method == 'initialize':
        if initialized:
            return response(req, error={'code': -32000, 'message': 'Already initialized'})
        client = params.get('clientInfo') or {}
        client_identity = (str(client.get('name', '')), str(client.get('version', '')))
        if not client_identity[0]:
            return response(req, error={'code': -32602, 'message': 'clientInfo.name required'})
        manifest = verify_manifest()
        initialized = True
        append_event('MCP_INITIALIZED', {'client': {'name': client_identity[0], 'version': client_identity[1]}, 'manifest_hash': manifest['manifest_hash']})
        return response(req, {'protocolVersion': PROTOCOL_VERSION, 'capabilities': {'tools': {}}, 'serverInfo': {'name': 'dreamledger-gateway', 'version': '1.2.0'}})
    if method == 'initialized':
        if not initialized:
            return response(req, error={'code': -32002, 'message': 'Initialize first'})
        return response(req, {})
    if not initialized:
        return response(req, error={'code': -32002, 'message': 'Initialize first'})
    call_count += 1
    if call_count > MAX_CALLS:
        return response(req, error={'code': -32000, 'message': 'Session quota exceeded'})
    if method == 'tools/list':
        manifest = verify_manifest()
        tools = []
        for t in manifest['tools']:
            tools.append({'name': t['name'], 'description': t['description'], 'inputSchema': {'type': 'object'}})
        return response(req, {'tools': tools})
    if method == 'tools/call':
        args = dict(params.get('arguments') or {})
        try:
            return response(req, {'content': [{'type': 'text', 'text': json.dumps(tool_call(params.get('name', ''), args), sort_keys=True)}]})
        except Exception as exc:
            return response(req, error={'code': -32000, 'message': str(exc)})
    return response(req, error={'code': -32601, 'message': 'Method not found'})


for line in sys.stdin:
    if not line.strip():
        continue
    if len(line.encode('utf-8')) > MAX_MESSAGE_BYTES:
        sys.stdout.write(json.dumps({'jsonrpc': '2.0', 'error': {'code': -32600, 'message': 'Message too large'}}) + '\n')
        sys.stdout.flush()
        continue
    try:
        req = json.loads(line)
        sys.stdout.write(json.dumps(handle(req), separators=(',', ':')) + '\n')
        sys.stdout.flush()
    except Exception as exc:
        sys.stdout.write(json.dumps({'jsonrpc': '2.0', 'error': {'code': -32603, 'message': str(exc)}}) + '\n')
        sys.stdout.flush()
