import json, os, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / 'runtime'
RUNTIME.mkdir(parents=True, exist_ok=True)
LM = os.getenv('LMSTUDIO_BASE_URL', 'http://127.0.0.1:1234/v1').rstrip('/')
MODEL = os.getenv('LMSTUDIO_MODEL', '')
GOAL = 'Generate verified external revenue as quickly as possible with minimal human effort. Never fabricate revenue.'


def get_json(url, timeout=12):
    req = urllib.request.Request(url, headers={'Accept':'application/json','User-Agent':'DreamLedger-MoneyLoop/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def lm_chat(messages):
    models = get_json(LM + '/models', 8)
    model = MODEL or (models.get('data') or [{}])[0].get('id')
    if not model:
        raise RuntimeError('No LM Studio model is loaded')
    body = json.dumps({'model': model, 'messages': messages, 'temperature': 0.1}).encode()
    req = urllib.request.Request(LM + '/chat/completions', data=body, method='POST', headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read().decode())
    return data['choices'][0]['message']['content']


def probe():
    result = {'timestamp': time.time(), 'goal': GOAL, 'checks': []}
    for name, url in [
        ('public_home','https://dreamledger.org/'),
        ('billboard','https://dreamledger.org/billboard'),
        ('dreammeez','https://dreamledger.org/dreammeez'),
        ('catalog','https://dreamledger.org/catalog.json'),
    ]:
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'DreamLedger-MoneyLoop/1.0'}), timeout=15) as r:
                result['checks'].append({'name':name,'ok':200 <= r.status < 400,'status':r.status})
        except Exception as e:
            result['checks'].append({'name':name,'ok':False,'error':str(e)[:240]})
    return result


def main():
    state = probe()
    (RUNTIME/'latest_probe.json').write_text(json.dumps(state, indent=2)+'\n', encoding='utf-8')
    prompt = [
        {'role':'system','content':'You are the local revenue orchestrator for DreamLedger. Optimize for verified external revenue. You may recommend actions, but deterministic checks are authoritative. Never claim a sale without settled payment plus attribution plus fulfillment plus evidence. Prefer existing live offers over building new products.'},
        {'role':'user','content':json.dumps({'goal':GOAL,'live_checks':state}, indent=2)},
    ]
    try:
        plan = lm_chat(prompt)
    except Exception as e:
        plan = 'LM_STUDIO_UNAVAILABLE: ' + str(e)
    out = {'timestamp':time.time(),'probe':state,'llm_plan':plan,'status':'UNVERIFIED'}
    (RUNTIME/'latest_plan.json').write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    main()
