'use strict';
// Demo-only 100-position billboard. No checkout, placement or inventory claims.
(function (root, create) {
  const api = create();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DreamLedgerBillboardPreview = api;
})(typeof window === 'object' ? window : null, function () {
  function titleOf(value) {
    return String(value == null ? '' : value).trim().slice(0, 80) || 'YOUR IDEA HERE';
  }
  function fontSizes(length) {
    if (length <= 12) return { actual: 20, enlarged: 46 };
    if (length <= 22) return { actual: 16, enlarged: 36 };
    if (length <= 38) return { actual: 12.5, enlarged: 28 };
    if (length <= 56) return { actual: 10.5, enlarged: 23 };
    return { actual: 8.5, enlarged: 18 };
  }
  function readability(length) {
    if (length <= 22) return 'Best fit: short names are easiest to recognize on the full board.';
    if (length <= 38) return 'The full label is visible in the enlarged view. Shorter headlines read better on the board.';
    return 'This full label is included, but long text will be small at 100 by 100 pixels. Use a short name for stronger visibility.';
  }
  function boardSlots() {
    return Array.from({length: 100}, (_, i) => ({number: i + 1, demo: i === 44}));
  }
  function fit(element, target, floor) {
    const parent = element.parentElement;
    element.style.fontSize = target + 'px';
    if (!parent) return;
    const pad = parent.classList.contains('tile-actual') ? 14 : 34;
    for (let i = 0; i < 65; i++) {
      if (element.scrollHeight <= parent.clientHeight - pad &&
          element.scrollWidth <= parent.clientWidth - pad) return;
      target = Math.max(floor, target - 0.5);
      element.style.fontSize = target + 'px';
      if (target === floor) return;
    }
  }
  function mount(doc) {
    const input = doc.getElementById('sample');
    const board = doc.getElementById('sample-board');
    const zoom = doc.getElementById('tile-text');
    const actual = doc.getElementById('tile-actual');
    const full = doc.getElementById('full-label');
    const advice = doc.getElementById('legibility-warning');
    const counter = doc.getElementById('sample-count');
    if ([input, board, zoom, actual, full, advice, counter].some(x => !x)) {
      throw Error('BILLBOARD_PREVIEW_DOM_MISSING');
    }
    board.replaceChildren();
    const fragment = doc.createDocumentFragment();
    let demo = null;
    boardSlots().forEach(position => {
      const cell = doc.createElement('span');
      cell.className = position.demo ? 'board-cell board-sample' : 'board-cell';
      if (position.demo) {
        cell.textContent = '*';
        cell.setAttribute('aria-label', 'Illustrative tile position 45, not a booked placement');
        demo = cell;
      } else cell.setAttribute('aria-hidden', 'true');
      fragment.appendChild(cell);
    });
    board.appendChild(fragment);
    function update() {
      const text = titleOf(input.value);
      const sizes = fontSizes(text.length);
      const zoomText = zoom.querySelector('span');
      const actualText = actual.querySelector('span');
      zoomText.textContent = text;
      actualText.textContent = text;
      fit(zoomText, sizes.enlarged, 7);
      fit(actualText, sizes.actual, 5.5);
      full.textContent = text;
      demo.title = 'Full demonstration label: ' + text;
      zoom.setAttribute('aria-label', 'Enlarged demo tile: ' + text);
      actual.setAttribute('aria-label', 'Actual 100 by 100 pixel demo tile: ' + text);
      counter.textContent = text.length + ' / 80 characters';
      advice.textContent = readability(text.length);
    }
    input.addEventListener('input', update);
    update();
  }
  return Object.freeze({titleOf,fontSizes,readability,boardSlots,mount});
});
