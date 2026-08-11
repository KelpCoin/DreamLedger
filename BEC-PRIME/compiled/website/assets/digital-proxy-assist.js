(function () {
  'use strict';
  if (window.__DREAMLEDGER_PROXY_ASSIST__) return;
  window.__DREAMLEDGER_PROXY_ASSIST__ = true;

  const style = document.createElement('style');
  style.textContent = '.dl-proxy{position:fixed;right:12px;bottom:12px;z-index:9999;font:14px system-ui,sans-serif}.dl-proxy button{border:1px solid #888;background:#111;color:#fff;border-radius:999px;padding:10px 14px;min-height:44px}.dl-proxy-panel{display:none;width:min(92vw,360px);max-height:70vh;overflow:auto;margin-bottom:8px;padding:12px;border:1px solid #aaa;border-radius:14px;background:#fff;color:#111;box-shadow:0 8px 30px rgba(0,0,0,.18)}.dl-proxy-panel.open{display:block}.dl-proxy-panel textarea{width:100%;box-sizing:border-box;min-height:80px;margin:8px 0}.dl-proxy-panel .reply{white-space:pre-wrap;line-height:1.45;margin:8px 0}.dl-proxy-panel button{border-radius:10px;margin-right:6px}.dl-proxy-panel small{display:block;opacity:.7;margin-top:8px}';
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'dl-proxy';
  wrap.innerHTML = '<div class="dl-proxy-panel" id="dl-proxy-panel" role="dialog" aria-label="DreamLedger help"><strong>Need help?</strong><div class="reply" id="dl-proxy-reply">Ask only when you want help. Nothing opens automatically.</div><textarea id="dl-proxy-input" maxlength="1200" placeholder="What are you trying to do?"></textarea><button type="button" id="dl-proxy-send">Ask</button><button type="button" id="dl-proxy-close">Close</button><small>Navigation help only. No passwords or payment secrets.</small></div><button type="button" id="dl-proxy-open" aria-expanded="false" aria-controls="dl-proxy-panel">Need help?</button>';
  document.body.appendChild(wrap);

  const panel = wrap.querySelector('#dl-proxy-panel');
  const open = wrap.querySelector('#dl-proxy-open');
  const close = wrap.querySelector('#dl-proxy-close');
  const send = wrap.querySelector('#dl-proxy-send');
  const input = wrap.querySelector('#dl-proxy-input');
  const reply = wrap.querySelector('#dl-proxy-reply');

  open.addEventListener('click', function () {
    panel.classList.add('open');
    open.setAttribute('aria-expanded', 'true');
    input.focus();
  });
  close.addEventListener('click', function () {
    panel.classList.remove('open');
    open.setAttribute('aria-expanded', 'false');
  });
  send.addEventListener('click', async function () {
    const message = input.value.trim();
    if (!message) return;
    send.disabled = true;
    reply.textContent = 'Working...';
    try {
      const response = await fetch('/api/digital-proxy/help', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, route: location.pathname })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Help request failed');
      reply.textContent = data.reply || 'No guidance returned.';
    } catch (err) {
      reply.textContent = 'The help service is unavailable. You can keep using the site normally.';
    } finally {
      send.disabled = false;
    }
  });
}());
