/* Executed by the cloud Website Gauntlet against the served public directory. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});const results=[];fs.mkdirSync('proof/phone',{recursive:true});
 for(const width of [360,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.PHONE_TEST_URL||'http://127.0.0.1:8765';
  await page.goto(base+'/');await page.evaluate(()=>document.fonts.ready);
  const theme=await page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,h:getComputedStyle(document.querySelector('h1')).fontFamily,signal:getComputedStyle(document.body).getPropertyValue('--signal')}));
  for(const route of ['/','/go/','/marketplace.html','/mtg/','/mtg/tools/','/mtg/market/','/mtg/community/','/mtg-list/']){
   await page.goto(base+route);await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow '+width+' '+route);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).fontFamily),theme.font,'Font drift '+route);
   if(route==='/mtg/'){
    await page.waitForSelector('#catalog .deck');assert.equal(await page.locator('[data-auction-slot]').count(),3);
    const slots=await page.locator('[data-auction-slot]').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,visible:e.getBoundingClientRect().right<=innerWidth,image:e.querySelector('img').complete&&e.querySelector('img').naturalWidth>0,label:e.innerText})));
    assert(slots.every(s=>s.top===slots[0].top&&s.visible&&s.image&&s.label.includes('Auction coming soon')),'All three card backs visible in one row');
    assert(await page.locator('#auctions').evaluate(e=>e.getBoundingClientRect().height)<170,'Compact header');
    assert.equal(await page.locator('#catalog .deck').count(),4);
    assert.equal(await page.locator('#catalog a[href*="stripe"]').count(),0);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('h1')).fontFamily),theme.h);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--signal')),theme.signal);
    if(width<500){await page.screenshot({path:'proof/phone/mtg-'+width+'.png',fullPage:true});const rail=page.locator('#catalog');await rail.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('catalog').scrollLeft>0);assert(await rail.evaluate(e=>e.scrollLeft)>0,'Keyboard scroll');await page.getByRole('button',{name:'Previous decks'}).click();}
    await page.locator('#search').fill('Dwynen');assert.equal(await page.locator('#catalog .deck').count(),1);
    await page.locator('#search').fill('zz-no-match');await page.getByRole('button',{name:'Clear filters'}).click();assert.equal(await page.locator('#catalog .deck').count(),4);
    await page.locator('.filter-disclosure summary').click();await page.locator('#max-price').fill('90');assert.equal(await page.locator('#catalog .deck').count(),2);
   }
   if(route==='/mtg/tools/'){
    await page.getByRole('button',{name:'Try an example'}).click();assert.match(await page.locator('#missing').inputValue(),/16 Forest/);
    await page.getByRole('button',{name:'Check my opening hand'}).click();assert.match(await page.locator('#odds-status').innerText(),/Chance of 2–4 lands/);
   }
   if(route==='/mtg/market/'){
    await page.locator('[name=card]').fill('Sol Ring');await page.locator('[name=buy]').fill('2');await page.locator('[name=sell]').fill('3');await page.locator('[name=quantity]').fill('4');await page.locator('[name=fees]').fill('1');await page.getByRole('button',{name:'Calculate net spread'}).click();assert.match(await page.locator('#spread-result').innerText(),/3\.000/);
   }
   if(route==='/mtg-list/'){
    await page.locator('[name=title]').fill('Sol Ring');await page.locator('[name=region]').fill('Wellington');await page.getByRole('button',{name:'Build my post'}).click();assert.match(await page.locator('#post-output').inputValue(),/Wellington/);
   }
   results.push({width,route,status:'PASS'});
  }
  assert.deepEqual(errors,[],'No runtime JS errors');await context.close();
 }
 await browser.close();fs.writeFileSync('proof/phone/results.json',JSON.stringify({sha:process.env.GITHUB_SHA,results},null,2));console.log('PHONE_CATALOG_PASS',results.length,'route/viewport checks');
})().catch(e=>{console.error(e);process.exit(1)});
