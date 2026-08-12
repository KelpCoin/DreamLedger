/* DreamLedger shared avatar runtime contract.
 * Browser target: phone-first Three.js + VRM/glTF.
 * The runtime renders canonical asset SKUs and can emit demand signals.
 * It never bypasses Elohim, Gauntlet, or Approval Governor.
 */
(function(){
  'use strict';
  const SHARED_ASSET_SCHEMA = '/contracts/shared-avatar-asset.schema.json';
  const REGISTRY = '/catalog/assets/shared-avatar-registry.json';
  const TARGETS = Object.freeze(['dreamiez','kelp-atlantis']);
  const DEMAND_ENDPOINT = '/api/demand/avatar';
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
    },
    submitDemandSignal: async function(signal){
      const body = Object.assign({}, signal || {}, {
        source: 'avatar-runtime',
        required_ecosystems: TARGETS.slice(),
        next_stage: 'ELOHIM_REFINERY',
        approval_required: true
      });
      const response = await fetch(DEMAND_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
      if(!response.ok){ throw new Error('Demand signal rejected by server'); }
      return response.json();
    }
  });
})();
