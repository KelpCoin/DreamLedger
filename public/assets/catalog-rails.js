(() => {
  function move(rail, direction) {
    rail.scrollBy({left: direction * rail.clientWidth * 0.85, behavior: 'auto'});
  }
  function setup() {
    document.querySelectorAll('.bec-grid').forEach((rail, index) => {
      rail.tabIndex = 0;
      rail.setAttribute('role', 'region');
      if (!rail.hasAttribute('aria-label')) {
        rail.setAttribute('aria-label', 'Catalogue cards ' + (index + 1) + '; swipe or use arrow keys');
      }
      rail.addEventListener('keydown', event => {
        if (event.target !== rail || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        move(rail, event.key === 'ArrowRight' ? 1 : -1);
      });
    });
    document.querySelectorAll('[data-rail]').forEach(button => {
      button.addEventListener('click', () => {
        const rail = document.getElementById(button.dataset.rail);
        if (rail) move(rail, Number(button.dataset.step));
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
