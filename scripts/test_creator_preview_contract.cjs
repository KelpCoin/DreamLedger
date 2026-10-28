'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/creator-studio.html','utf8');
for(const id of ['fit-body','fit-scale','fit-export','wearable-preview','origin','parent','access','rights'])
 assert(html.includes('id="'+id+'"'),'missing local-only creative control '+id);
for(const phrase of ['standard','slim','broad','hand_drawn','ai_enhanced','rights_confirmed',
  'parent_draft_id','toDataURL','ASSET-','private'])
 assert(html.includes(phrase),'missing private artwork origin or fit control '+phrase);
assert(html.includes('This is a local concept overlay'));
assert(html.includes('not approved or equipped wearable artwork'));
assert(!html.includes("localStorage.setItem('access'"),'creator key must never persist in browser storage');
const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert(matches.length>=1,'creator page needs inline logic');
for(const [,script]of matches)new vm.Script(script,{filename:'creator-studio.inline.js'});
console.log('BECK_PRIVATE_DUAL_CREATOR_ART_FIT_PREVIEW=PASS');
