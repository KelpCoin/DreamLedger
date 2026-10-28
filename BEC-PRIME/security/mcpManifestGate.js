'use strict';
// Static owner-reviewed hash. The embedded hash INSIDE a manifest is not an authority.
const fs=require('node:fs');
const crypto=require('node:crypto');
const APPROVED_SHA256='4b36973af568f7038cf6a137c6a23ff5ae308e398c11b97ca5a4bfad63d49efe';
const TOOL_POLICY=Object.freeze({
 dl_read_cartridge:'READ_ONLY',
 dl_read_inventory:'READ_ONLY',
 dl_read_ledger:'READ_ONLY',
 dl_propose_offer:'PROPOSAL_ONLY',
 dl_verify_proof:'READ_ONLY',
 dl_propose_checkout:'PROPOSAL_ONLY'
});
function canonical(m){return JSON.stringify({schema_version:m.schema_version,gateway:m.gateway,transport:m.transport,protocol_version:m.protocol_version,tools:m.tools},null,2)+'\n';}
function sha(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function validateManifest(m){
 if(!m||typeof m!=='object'||!Array.isArray(m.tools))throw new Error('INVALID_MCP_MANIFEST');
 if(m.transport!=='stdio'||m.protocol_version!=='2025-11-25')throw new Error('MCP_TRANSPORT_OR_VERSION_DRIFT');
 const derived=sha(canonical(m));
 if(derived!==m.manifest_hash)throw new Error('MCP_MANIFEST_SELF_HASH_INVALID');
 if(derived!==APPROVED_SHA256)throw new Error('MCP_UNAPPROVED_TOOL_MANIFEST_DRIFT');
 if(m.tools.length!==Object.keys(TOOL_POLICY).length)throw new Error('MCP_TOOL_COUNT_DRIFT');
 for(const tool of m.tools)if(TOOL_POLICY[tool.name]!==tool.permission)throw new Error('MCP_TOOL_PERMISSION_DRIFT');
 return {ok:true,manifest_hash:derived,tool_count:m.tools.length};
}
function verifyFile(file){return validateManifest(JSON.parse(fs.readFileSync(file,'utf8')));}
module.exports={APPROVED_SHA256,canonical,sha,validateManifest,verifyFile};
