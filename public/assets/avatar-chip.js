/** Floating mini-avatar chip — include on any page after avatar-identity.js */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.DreamLedgerAvatar) return;
  if (document.getElementById('dl-avatar-chip')) return;

  var SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3317', '#f5d0c5', '#d4a574'];

  function mount() {
    var s = DreamLedgerAvatar.load();
    var chip = document.createElement('a');
    chip.id = 'dl-avatar-chip';
    chip.href = '/avatar.html';
    chip.title = 'Your DreamMeez - customize and view real offers';
    chip.setAttribute('aria-label', 'Open avatar studio');
    chip.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:8px 12px 8px 8px', 'border-radius:999px',
      'background:#121216ee', 'border:1px solid #2a2a32',
      'color:#f7f4ed', 'text-decoration:none', 'font:12px/1.2 system-ui,sans-serif',
      'box-shadow:0 8px 28px #0008', 'backdrop-filter:blur(12px)'
    ].join(';');

    var face = document.createElement('span');
    face.style.cssText = 'width:36px;height:36px;border-radius:50%;border:2px solid #09090c;display:block;background:' +
      (SKINS[s.skin] || SKINS[3]) + ';position:relative;flex:0 0 auto';

    var label = document.createElement('span');
    label.style.cssText = 'display:flex;flex-direction:column;gap:2px;max-width:120px';
    var name = document.createElement('strong');
    name.style.cssText = 'font-size:12px;letter-spacing:-0.02em';
    name.textContent = s.display_name || 'Your avatar';
    var sub = document.createElement('span');
    sub.style.cssText = 'font-size:10px;color:#9897a2';
    var n = (s.owned && s.owned.length) || 0;
    sub.textContent = n ? n + ' local previews' : 'Customize for free';
    label.appendChild(name);
    label.appendChild(sub);

    chip.appendChild(face);
    chip.appendChild(label);
    document.body.appendChild(chip);

    window.addEventListener('dreamledger:avatar-updated', function (ev) {
      var st = ev.detail || DreamLedgerAvatar.load();
      name.textContent = st.display_name || 'Your avatar';
      face.style.background = SKINS[st.skin] || SKINS[3];
      var c = (st.owned && st.owned.length) || 0;
      sub.textContent = c ? c + ' local previews' : 'Customize for free';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
