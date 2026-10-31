import {createHmac,createHash,timingSafeEqual} from "node:crypto";

const ACTIONS=new Set(["register","inventory","auction_submit","buy_now_set","buy_now","watch","bid","ship","deliver","dispute","checkout"]);
const CAPABILITY="kingdom.auction.v1";
const HEX64=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,63}$/;
const REF=/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{7,159}$/;
const SHA1=/^[0-9a-f]{40}$/;
const ERROR_CODES=new Set(["UNCONFIGURED","BAD_ENVELOPE","BAD_SIGNATURE","NOT_AUTHORIZED","EXPIRED","NOT_YET_ACTIVE","WRONG_SILO","WRONG_DEPLOYMENT","SCOPE_DENIED","INVALID_ARGUMENT"]);
const hash=value=>createHash("sha256").update(value).digest("hex");
const canonical=value=>JSON.stringify(value);
const mac=(payload,secret)=>createHmac("sha256",secret).update(canonical(payload)).digest("hex");
const deny=code=>({ok:false,code:ERROR_CODES.has(code)?code:"NOT_AUTHORIZED"});

export function issueAuctionAllocation({scorecard,scorecardBytes,approval,resource,secret,now=Date.now()}){
 if(!secret||typeof secret!=="string"||secret.length<32)throw Error("SIGNING_KEY_REQUIRED");
 if(!scorecard||scorecard.schema!=="gauntlet-scorecard/v1"||scorecard.overall!=="PASS"||
  !SLUG.test(scorecard.scope?.id||"")||!REF.test(scorecard.scorecard_id||""))throw Error("GAUNTLET_PASS_REQUIRED");
 if(typeof scorecardBytes!=="string"||!HEX64.test(hash(scorecardBytes))||
  canonical(JSON.parse(scorecardBytes))!==canonical(scorecard))throw Error("SCORECARD_BYTES_MISMATCH");
 if(approval?.explicit!==true||!REF.test(approval.reference||"")||
  !["EXPERIMENT_APPROVED","REPEATABLE_MARGIN_VERIFIED"].includes(approval.economic_basis)||
  approval.capability!==CAPABILITY||approval.silo_id!==scorecard.scope.id)
  throw Error("EXPLICIT_OWNER_APPROVAL_REQUIRED");
 if(resource?.capability_id!==CAPABILITY||resource?.silo_id!==scorecard.scope.id||
  !Array.isArray(resource.actions)||resource.actions.length===0||
  resource.actions.some(a=>!ACTIONS.has(a))||
  !SHA1.test(resource.deployment_sha||""))throw Error("INVALID_RESOURCE_ALLOCATION");
 if(!Number.isSafeInteger(resource.duration_seconds)||resource.duration_seconds<60||
  resource.duration_seconds>86400)throw Error("GRANT_DURATION_INVALID");
 if(!Number.isFinite(now)||now<0)throw Error("INVALID_CLOCK");
 const issued=new Date(now).toISOString();
 const payload={
  schema:"kingdom/auction-allocation/v1",capability_id:CAPABILITY,
  silo_id:resource.silo_id,actions:[...new Set(resource.actions)].sort(),
  scorecard_id:scorecard.scorecard_id,scorecard_sha256:hash(scorecardBytes),
  economic_basis:approval.economic_basis,approval_reference:approval.reference,
  deployment_sha:resource.deployment_sha,issued_at:issued,
  expires_at:new Date(now+resource.duration_seconds*1000).toISOString(),
  decision:"ALLOW"
 };
 return {payload,signature:mac(payload,secret)};
}

export function verifyAuctionAllocation({envelope,secret,siloId,action,deploymentSha,now=Date.now()}){
 if(!secret||typeof secret!=="string"||secret.length<32)return deny("UNCONFIGURED");
 if(!ACTIONS.has(action)||!SLUG.test(siloId||"")||!SHA1.test(deploymentSha||"")||
  !Number.isFinite(now))return deny("INVALID_ARGUMENT");
 let signed=envelope;
 if(typeof signed==="string"){try{signed=JSON.parse(signed)}catch{return deny("BAD_ENVELOPE")}}
 if(!signed||typeof signed!=="object"||Array.isArray(signed)||!signed.payload||
  !HEX64.test(signed.signature||""))return deny("BAD_ENVELOPE");
 const p=signed.payload;
 if(p.schema!=="kingdom/auction-allocation/v1"||p.capability_id!==CAPABILITY||
  p.decision!=="ALLOW"||!SLUG.test(p.silo_id||"")||
  !REF.test(p.scorecard_id||"")||!HEX64.test(p.scorecard_sha256||"")||
  !REF.test(p.approval_reference||"")||
  !["EXPERIMENT_APPROVED","REPEATABLE_MARGIN_VERIFIED"].includes(p.economic_basis)||
  !SHA1.test(p.deployment_sha||"")||
  !Array.isArray(p.actions)||!p.actions.length||p.actions.some(a=>!ACTIONS.has(a))||
  !p.issued_at||!p.expires_at)return deny("BAD_ENVELOPE");
 const expected=Buffer.from(mac(p,secret),"hex"),actual=Buffer.from(signed.signature,"hex");
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return deny("BAD_SIGNATURE");
 if(p.silo_id!==siloId)return deny("WRONG_SILO");
 if(p.deployment_sha!==deploymentSha)return deny("WRONG_DEPLOYMENT");
 const start=Date.parse(p.issued_at),end=Date.parse(p.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)return deny("BAD_ENVELOPE");
 if(now<start)return deny("NOT_YET_ACTIVE");
 if(now>=end)return deny("EXPIRED");
 if(!p.actions.includes(action))return deny("SCOPE_DENIED");
 return {ok:true,capability_id:CAPABILITY,silo_id:siloId,scorecard_sha256:p.scorecard_sha256,
  approval_reference:p.approval_reference,economic_basis:p.economic_basis,expires_at:p.expires_at};
}

export const AUCTION_CAPABILITY_ID=CAPABILITY;
export const AUCTION_MUTATION_ACTIONS=Object.freeze([...ACTIONS]);
