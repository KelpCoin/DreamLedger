'use strict';
const fs=require('fs'),path=require('path');
const {TOTAL,candidateFor}=require('../swarm/QSwarmOfferFactory');
const OUT=path.join(__dirname,'..','data','q-swarm-100k','Q-SWARM-100K-MANIFEST.jsonl');
const PROOF=path.join(__dirname,'..','data','q-swarm-100k','Q-SWARM-100K-PROOF.json');
const dir=path.dirname(OUT);fs.mkdirSync(dir,{recursive:true});const out=fs.createWriteStream(OUT,{encoding:'utf8'});let survivors=0,killed=0;
for(let i=1;i<=TOTAL;i++){const row=candidateFor(i);if(row.survivor)survivors++;else killed++;out.write(JSON.stringify(row)+'\n');}
out.end();out.on('finish',function(){const proof={schema:'DREAMLEDGER/Q-SWARM-100K-PROOF/v1',status:'PASS',generated_candidates:TOTAL,survivors:survivors,killed:killed,http_route_contract:'https://dreamledger.org/swarm/{index}',api_route_contract:'https://dreamledger.org/api/swarm-100k/{index}',public_execution:'BLOCKED_UNTIL_HUMAN_APPROVAL',truth:{verified_external_revenue_nzd:0,settled_external_payments:0,independent_external_buyers:0,verified_economic_outcomes:0}};fs.writeFileSync(PROOF,JSON.stringify(proof,null,2)+'\n','utf8');console.log(JSON.stringify(proof,null,2));});