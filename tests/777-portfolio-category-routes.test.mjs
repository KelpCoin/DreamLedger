import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync('BEC-PRIME/catalog/silos/CUBE-SILO-REGISTRY.json','utf8'));
const added=['beck','commerce','truth-oracle','billboard','marketplace','demand','games','memberships','factory-candidates','digital-tools','identity','community','auctions','creators','advertising'];
test('portfolio routes are stable and unique',()=>{const ids=registry.silos.map(x=>x.id);assert.equal(new Set(ids).size,ids.length);for(const i of added){const x=registry.silos.find(s=>s.id===i);assert.equal(x.route,'/'+i);assert.equal(x.status,'private_staged');assert.equal(x.public_enabled,false);assert.equal(x.approval_required,true)}});
test('existing master template remains',()=>assert.equal(registry.silos.find(x=>x.id==='mtg').status,'active'));
test('commercial and privacy rules fail closed',()=>{assert.equal(registry.rules.public_actions_approval_gated,true);assert.equal(registry.rules.pending_categories_never_auto_publish,true);assert.equal(registry.rules.sensitive_content_isolation_required,true);assert.equal(registry.rules.proposed_routes_are_not_dns_or_deployment_proof,true)});
