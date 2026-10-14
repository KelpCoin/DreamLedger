(function () {
  'use strict';
  function mount() {
    const host = document.querySelector('[data-dreamledger-qr]');
    if (!host || host.dataset.mounted === 'true') return;
    host.dataset.mounted = 'true';
    const section = document.createElement('section');
    section.className = 'dreamledger-canonical-qr';
    section.setAttribute('aria-label', 'Share DreamLedger');
    const heading = document.createElement('h2');
    heading.textContent = 'Share DreamLedger';
    const note = document.createElement('p');
    note.textContent = 'Know someone who would find DreamLedger useful? Share this first-party QR code.';
    const link = document.createElement('a');
    link.href = 'https://dreamledger.org/go?src=qr-canonical';
    link.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.src = '/assets/qr-canonical.svg';
    image.alt = 'Scan to explore and share DreamLedger';
    image.width = 220;
    image.height = 220;
    image.loading = 'lazy';
    link.appendChild(image);
    const textLink = document.createElement('a');
    textLink.href = 'https://dreamledger.org/go?src=qr-canonical';
    textLink.textContent = 'dreamledger.org/go';
    textLink.rel = 'noopener noreferrer';
    const truth = document.createElement('p');
    truth.className = 'qr-truth';
    truth.textContent = 'A scan is an acquisition signal, not proof of payment or delivery.';
    const style = document.createElement('style');
    style.textContent = '.dreamledger-canonical-qr{margin-top:22px;padding:18px;border:1px solid #7c8b9b55;border-radius:14px;text-align:center}.dreamledger-canonical-qr h2{font-size:1.15rem;margin:0 0 8px}.dreamledger-canonical-qr p{font-size:13px;line-height:1.5;color:inherit;opacity:.82}.dreamledger-canonical-qr img{display:block;width:220px;height:220px;max-width:100%;object-fit:contain;background:#fff;padding:8px;border-radius:8px;margin:14px auto;image-rendering:pixelated}.dreamledger-canonical-qr a{overflow-wrap:anywhere}.dreamledger-canonical-qr .qr-truth{font-size:11px;margin-top:10px}';
    section.append(style, heading, note, link, textLink, truth);
    host.appendChild(section);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
