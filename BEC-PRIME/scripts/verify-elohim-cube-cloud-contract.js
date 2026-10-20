'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }

const factoryPath = 'BEC-PRIME/cube/CUBE-SILO-FACTORY-CONTRACT.json';
const packageSchemaPath = 'BEC-PRIME/schemas/elohim-beachhead-package.schema.json';
const factory = readJson(factoryPath);
const packageSchema = readJson(packageSchemaPath);
const registry = readJson('BEC-PRIME/cube/CUBE-SILO-REGISTRY.json');
const candidateSchema = readJson('BEC-PRIME/schemas/elohim-candidate.schema.json');
const gpuWorkflow = fs.readFileSync(path.join(root, '.github/workflows/economic-gpu-opportunistic.yml'), 'utf8');
const pipeline = factory.activation_pipeline || [];
const elohimIndex = pipeline.indexOf('elohim_package_validation');
const supplyIndex = pipeline.indexOf('verify_supply');
const compileIndex = pipeline.indexOf('compile_candidate');
const gauntletIndex = pipeline.indexOf('gauntlet_check');
const approvalIndex = pipeline.indexOf('publish_approval_gate');

check(factory.elohim_package_contract === packageSchemaPath, 'Factory contract must reference the canonical Elohim package schema.');
check(elohimIndex >= 0 && elohimIndex < supplyIndex && elohimIndex < compileIndex, 'Elohim validation must precede supply verification and candidate compilation.');
check(compileIndex >= 0 && compileIndex < gauntletIndex && gauntletIndex < approvalIndex, 'Compilation, Gauntlet, and publication approval order is invalid.');
check(factory.runtime_policy && factory.runtime_policy.cloud_is_authoritative === true, 'Cloud must remain the authoritative control plane.');
check(factory.runtime_policy && factory.runtime_policy.local_compute_optional === true && factory.runtime_policy.gpu_acceleration_optional === true, 'Local compute and GPU acceleration must remain optional.');
check(factory.runtime_policy && factory.runtime_policy.fail_closed_on_missing_or_invalid_package === true, 'Missing or invalid Elohim packages must fail closed.');
check(packageSchema.required.indexOf('artifact_sha256') >= 0 && packageSchema.required.indexOf('provenance') >= 0, 'Elohim package must carry provenance and artifact digest.');
check(packageSchema.properties.created_by && packageSchema.properties.created_by.const === 'ELOHIM', 'Only Elohim may be package creator.');
check(packageSchema.properties.release && packageSchema.properties.release.properties.production_allowed.const === false, 'Generated package cannot authorize production by itself.');
check(packageSchema.properties.isolation && packageSchema.properties.isolation.properties.cross_silo_customer_data.const === false, 'Cross-silo customer data must remain disabled.');
check(candidateSchema.properties.created_by && candidateSchema.properties.created_by.const === 'ELOHIM', 'Existing Elohim candidate schema must preserve provenance.');
check(candidateSchema.properties.approval_required && candidateSchema.properties.approval_required.type === 'boolean', 'Existing candidate schema must retain approval requirement.');
check(registry.cross_silo_data === false, 'Canonical CUBE registry must preserve cross-silo isolation.');
check(Array.isArray(registry.silos) && registry.silos.length > 0, 'CUBE registry must contain silo definitions.');
check(gpuWorkflow.indexOf('runs-on: [self-hosted, gpu]') >= 0, 'GPU worker must remain an optional self-hosted GPU job.');
check(gpuWorkflow.indexOf('gpu-lmstudio-status.json') >= 0, 'GPU worker must write a separate LM Studio status file.');
check(gpuWorkflow.indexOf('if (-not $status.online)') >= 0, 'GPU worker must use parsed online status, not string matching.');
check(gpuWorkflow.indexOf('model = $modelId') >= 0, 'GPU worker must use a model ID returned by LM Studio.');
check(gpuWorkflow.indexOf('retention-days: 14') >= 0, 'GPU outputs must have bounded artifact retention.');

const result = {
  schema: 'DREAMLEDGER/ELOHIM-CUBE-CLOUD-CONTRACT/v1',
  status: failures.length ? 'FAIL' : 'PASS',
  factory_contract: factoryPath,
  package_schema: packageSchemaPath,
  registered_silo_count: registry.silos.length,
  activation_pipeline: pipeline,
  cloud_authoritative: !!(factory.runtime_policy && factory.runtime_policy.cloud_is_authoritative),
  gpu_optional: !!(factory.runtime_policy && factory.runtime_policy.gpu_acceleration_optional),
  failures: failures
};
const proofPath = path.join(root, 'BEC-PRIME', 'PROOF-ELOHIM-CUBE-CLOUD-CONTRACT.json');
fs.writeFileSync(proofPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
