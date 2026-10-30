'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const theme=read('public/assets/dreamledger-mtg-theme.css');
assert.match(theme,/html\[data-silo="mtg"\]/);
assert.match(theme,/#45fa84/i);
assert.match(theme,/#070c0a/i);
assert.match(theme,/--silo-serif:system-ui/);
assert.doesNotMatch(theme,/@import|fonts\.googleapis|<script/i,'no new third-party fonts or requests');
const manifest=JSON.parse(read('public/silos/mtg/silo.json'));
assert.equal(manifest.accent,'#45fa84');
assert.equal(manifest.accent_bright,'#79ffa2');
for(const p of [
 'public/mtg/index.html',
 'public/mtg/exchange.html',
 'public/mtg/community.html',
 'public/mtg/diagnostic/index.html',
 'public/mtg/quintorius-field-historian.html',
 'public/mtg/dwynen-gilt-leaf-daen.html',
 'public/mtg/jon-irenicus-shattered-one.html',
 'mtg/index.html',
 'BEC-PRIME/compiled/website/mtg/index.html',
 'BEC-PRIME/website/mtg-catalog.html'
]){
 const s=read(p);
 assert.match(s,/data-silo="mtg"/,p+': scope');
 assert.match(s,/dreamledger-mtg-theme\.css/,p+': shared theme');
}
const home=read('public/mtg/index.html');
const header=home.slice(home.indexOf('<header'),home.indexOf('</header>')+9);
const hero=home.slice(home.indexOf('<section class="hero">'),home.indexOf('</section>',home.indexOf('<section class="hero">'))+10);
const footer=home.slice(home.indexOf('<footer'),home.indexOf('</footer>')+9);
assert.doesNotMatch(header,/patreon\.com|discord\.gg|Happy Homarid/i,'creator links must not dominate primary navigation');
assert.doesNotMatch(hero,/Happy Homarid/i,'the creator brand belongs below the hero');
assert.match(header,/\/mtg\/community\.html/,'community trading remains discoverable');
assert.match(footer,/Happy Homarid Patreon/);
assert.match(footer,/Happy Homarid MTG Discord/);
assert.match(home,/Commander diagnostic · NZ\$29/);
assert.doesNotMatch(home,/two included per month|two-per-month/);
console.log('PASS MTG brand continuity: neon green + black, consistent typography, creator links in footer; paid diagnostic preserved.');
