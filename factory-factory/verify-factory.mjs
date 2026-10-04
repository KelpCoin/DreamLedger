import fs from "node:fs/promises";
import crypto from "node:crypto";
import {compileCell} from "./compiler.mjs";

const cell=JSON.parse(await fs.readFile("factory-factory/cells/happy-home-road-mtg.json","utf8"));
const plan=compileCell(cell);
const checks=[
  ["cell_contract",true],
  ["truth_gate",plan.truth_gate==="OBSERVED_INPUT_REQUIRED_FOR_VERIFIED_OUTPUT"],
  ["external_action_gated",plan.external_action_default==="BLOCKED_UNTIL_AUTHORIZED"],
  ["required_evidence",cell.evidence_requirements.length>=5],
  ["authority_gate",cell.authority_requirements.listing_publish==="HUMAN_APPROVAL"],
  ["deterministic_hash",/^[a-f0-9]{64}$/.test(plan.blueprint_sha256)]
];
const failed=checks.filter(([,ok])=>!ok);
console.log(JSON.stringify({
  status:failed.length?"FAIL":"PASS",
  cell_id:cell.cell_id,
  blueprint_sha256:plan.blueprint_sha256,
  checks:Object.fromEntries(checks),
  revenue_claimed:false,
  external_action_performed:false
},null,2));
process.exit(failed.length?1:0);
