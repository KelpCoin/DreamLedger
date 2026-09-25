/* Floating QR inject DISABLED for web.
 * Print-only QR lives at /qr/overpaying — do not inject on pages.
 */
(function () {
  'use strict';
  try {
    var el = document.getElementById('dreamledger-qr-overpaying-power');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch (e) {}
})();
