import fs from "node:fs/promises";
import crypto from "node:crypto";

const REQUIRED = [
  "cell_id","economic_object","buyer_definition","demand_signal","offer",
  "transaction_channel","fulfillment_method","evidence_requirements",
  "verification_rules","authority_requirements","failure_conditions",
  "lifecycle_state","owner_authority_requirements"
];

function sha256(value){return crypto.createHash("sha256").update(value).digest("hex");}

export function compileCell(cell){
  for(const key of REQUIRED){
    if(cell[key] === undefined) throw new Error("Missing cell field: "+key);
  }
  if(!["WATCH","READY","ACTIVE","QUARANTINED","REPLICABLE"].includes(cell.lifecycle_state)){
    throw new Error("Invalid lifecycle_state");
  }
  return {
    cell_id:cell.cell_id,
    blueprint_sha256:sha256(JSON.stringify(cell)),
    stages:[
      "SIGNAL","OPPORTUNITY","PROPOSITION","GAUNTLET","APPROVAL",
      "EXTERNAL_EFFECT","OBSERVATION","SETTLEMENT","PROOF","MECHANISM","REPLICATION"
    ],
    authority_gate:cell.authority_requirements,
    truth_gate:"OBSERVED_INPUT_REQUIRED_FOR_VERIFIED_OUTPUT",
    external_action_default:"BLOCKED_UNTIL_AUTHORIZED"
  };
}

if(process.argv[1] && process.argv[1].endsWith("compiler.mjs")){
  const file=process.argv[2] || "factory-factory/cells/happy-home-road-mtg.json";
  const cell=JSON.parse(await fs.readFile(file,"utf8"));
  process.stdout.write(JSON.stringify(compileCell(cell),null,2)+"\n");
}
