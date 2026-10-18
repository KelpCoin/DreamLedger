/* DreamLedger shared avatar runtime.
 * Web DreamMeez + Phinhaven share one identity (avatar-identity.js).
 * Cosmetics: web = visual layers; Phinhaven = buff metadata via adapter.
 */
(function () {
  'use strict';
  var TARGETS = Object.freeze(['dreammeez', 'phinhaven', 'web']);
  window.DreamLedgerAvatarRuntime = Object.freeze({
    version: '2026-10-16',
    ecosystems: TARGETS,
    identityScript: '/assets/avatar-identity.js',
    chipScript: '/assets/avatar-chip.js',
    studioPath: '/avatar.html',
    invariant: 'one-identity-multiple-surfaces',
    preferredFormats: ['css-layer', 'png', 'vrm', 'gltf'],
    phoneFirst: true,
    loadIdentity: function () {
      if (!window.DreamLedgerAvatar) throw new Error('avatar-identity.js not loaded');
      return window.DreamLedgerAvatar.load();
    },
    exportPhinhaven: function () {
      if (!window.DreamLedgerAvatar) throw new Error('avatar-identity.js not loaded');
      return window.DreamLedgerAvatar.toPhinhavenLoadout();
    },
    mountChip: function () {
      var s = document.createElement('script');
      s.src = '/assets/avatar-chip.js';
      s.async = true;
      document.head.appendChild(s);
    }
  });
})();
