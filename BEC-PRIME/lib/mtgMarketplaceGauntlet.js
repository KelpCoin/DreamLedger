'use strict';
/* MTG Marketplace local admission gauntlet.
 * Narrow deterministic signals, not a complete toxicity classifier.
 * Suspicious material is held for human appeal, not silently scored as trustworthy.
 */
const MAX_LENGTH=6000;
function normalize(v){return String(v==null?'':v).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');}
function inspectListing(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {decision:'REJECT',reason_codes:['INVALID_INPUT']};
 const text=['title','description','trade_wanted','set_name'].map(k=>normalize(input[k])).join(' ').trim();
 const errors=[],review=[];
 if(text.length>MAX_LENGTH)errors.push('TEXT_LIMIT');
 if(/<\s*(?:script|iframe|object|embed|svg|form)\b/i.test(text))errors.push('EMBEDDED_MARKUP');
 const links=(text.match(/https?:\/\//ig)||[]).length;
 if(links>=3)review.push('LINK_SPAM');
 if(/(?:.)\1{22,}/u.test(text))review.push('REPETITIVE_CONTENT');
 if(/\b(?:join our telegram|guaranteed 100% profit|free money claim|send gift cards to reserve)\b/i.test(text))
   review.push('COMMERCIAL_SPAM_PATTERN');
 // High-confidence direct harassment threats, not ordinary MTG game terminology.
 if(/\b(?:i will|we will)\s+(?:physically )?(?:hurt|assault|murder)\s+(?:you|your family|that person)\b/i.test(text))
   review.push('DIRECT_THREAT');
 // Evasion/control characters can be used to obfuscate abuse.
 if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u202A-\u202E]/.test(text))
   review.push('OBFUSCATED_CONTROL_TEXT');
 const decision=errors.length?'REJECT':review.length?'QUARANTINE':'PASS';
 return Object.freeze({
  decision,reason_codes:[...new Set([...errors,...review])],
  policy:'MTG_PEER_LISTING_RULEPACK_V1',
  reviewer_required:decision==='QUARANTINE',
  meaning:'PASS means admission checks only, not validation of seller identity, inventory or price.'
 });
}
module.exports={inspectListing};
