'use strict';
// Only approved customer surfaces are exposed by the Render storefront.
// Runtime APIs and data are separately handled; no private account data here.
const EXACT=new Set([
  '/','/index.html','/healthz','/version','/status','/status/','/status.html',
  '/billboard','/billboard/','/billboard.html',
  '/avatar','/avatar/','/avatar.html','/account','/account/','/account.html',
  '/login','/login/','/login.html','/register','/register/','/register.html',
  '/ticker','/ticker/','/ticker.html',
  '/privacy','/privacy/','/privacy.html','/terms','/terms/','/terms.html',
  '/contact','/contact/','/contact.html','/robots.txt','/favicon.ico'
]);
function allowedPublicRoute(input){
  const p=String(input||'');
  if(EXACT.has(p))return true;
  if(/^\/(?:mtg|phinhaven|dreammeez)(?:[\/.\-]|$)/i.test(p))return true;
  if(/^\/assets\//i.test(p))return true;
  if(/^\/data\/(?:mtg-catalog\.json|mtg-owner-decks\.json|mtg-owner-singles\.json|mtg-auctions\.json|decklists\/|avatar|dreammeez|phinhaven)/i.test(p))return true;
  if(p==='/catalog.json')return true;
  if(/^\/\.well-known\/(?:security\.txt|assetlinks\.json|apple-app-site-association)$/i.test(p))return true;
  return false;
}
module.exports={allowedPublicRoute};
