/* Public avatar runtime.
 * Internal pipeline names, provenance records, filesystem paths and governance
 * details stay server-side. The browser only receives the public asset contract.
 */
(function(){
  'use strict';
  const REGISTRY = '/catalog/assets/shared-avatar-registry.json';
  const TARGETS = Object.freeze(['dreamiez','kelp-atlantis']);
  const DEMAND_ENDPOINT = '/api/demand/avatar';
  window.DreamLedgerAvatarRuntime = Object.freeze({
    registry: REGISTRY,
    ecosystems: TARGETS,
    invariant: 'one-public-asset-two-ecosystems',
    preferredFormats: ['vrm','gltf'],
    phoneFirst: true,
    loadAsset: async function(asset){
      const compat = asset && asset.ecosystem_compatibility;
      if(!Array.isArray(compat) || !TARGETS.every(function(x){return compat.indexOf(x) !== -1;})){
        throw new Error('Avatar asset is not compatible with the requested worlds');
      }
      return asset;
    },
    submitDemandSignal: async function(signal){
      const body = Object.assign({}, signal || {}, {source:'avatar-runtime'});
      const response = await fetch(DEMAND_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!response.ok)throw new Error('Avatar demand request rejected');
      return response.json();
    }
  });
})();
