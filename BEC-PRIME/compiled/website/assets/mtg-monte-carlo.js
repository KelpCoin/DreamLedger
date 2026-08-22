(function(global){
'use strict';
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const TYPES=['draw','land','cast','attack','block','removal','combo'];
function fixture(seed,a,b,turns){const rng=mulberry32(seed);let sa=0,sb=0;for(let t=0;t<turns;t++){const ia=rng()<.5;const type=TYPES[Math.floor(rng()*TYPES.length)];const w=rng();if(ia)sa+=w;else sb+=w;}return{winner:sa>=sb?'A':'B',scoreA:sa,scoreB:sb};}
function run(options){options=options||{};const seed=Number(options.seed||12345)>>>0;const turns=Math.max(2,Math.min(40,Number(options.turns||10)));const trials=Math.max(100,Math.min(100000,Number(options.trials||10000)));let a=0,b=0;let sumA=0,sumB=0;for(let i=0;i<trials;i++){const r=fixture((seed+i)>>>0,'A','B',turns);if(r.winner==='A')a++;else b++;sumA+=r.scoreA;sumB+=r.scoreB;}return{engine:'dreamledger-cinema-monte-carlo-v1',seed,turns,trials,winsA:a,winsB:b,winRateA:Number((a/trials*100).toFixed(2)),winRateB:Number((b/trials*100).toFixed(2)),meanScoreA:Number((sumA/trials).toFixed(4)),meanScoreB:Number((sumB/trials).toFixed(4)),note:'This is a Monte Carlo analysis of the deterministic Cinema fixture engine, not a claim of rules-accurate Magic gameplay simulation.'};}
global.DreamLedgerMTGMonteCarlo={run};
})(window);
