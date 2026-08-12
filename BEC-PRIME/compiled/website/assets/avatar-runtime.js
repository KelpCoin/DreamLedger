/* DreamLedger shared avatar runtime contract.
 * Browser target: phone-first Three.js + VRM/glTF.
 * The runtime never owns ecosystem identity. It renders canonical asset SKUs.
 */
(function(){
  'use strict';
  const SHARED_ASSET_SCHEMA = '/contracts/shared-avatar-asset.schema.json';
  const REGISTRY = '/catalog/assets/shared-avatar-registry.json';
  const TARGETS = Object.freeze(['dreamiez','kelp-atlantis']);
  window.DreamLedgerAvatarRuntime = Object.freeze({
    schema: SHARED_ASSET_SCHEMA,
    registry: REGISTRY,
    ecosystems: TARGETS,
    invariant: 'one-canonical-asset-two-ecosystems',
    preferredFormats: ['vrm','gltf'],
    phoneFirst: true,
    loadAsset: async function(asset){
      const compat = asset && asset.ecosystem_compatibility;
      const valid = Array.isArray(compat) && TARGETS.every(function(x){return compat.indexOf(x) !== -1;});
      if(!valid){
        throw new Error('Shared asset invariant failed: both ecosystems are required');
      }
      return asset;
    }
  });
})();
