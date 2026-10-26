'use strict';
/**
 * Private digital deliverables. Reuses Stripe's signed webhook verification.
 * No checkout or publication is performed by this module.
 *
 * SECURITY: Never put the paid bytes inside public/, a public Git repository,
 * or a public Blob bucket. Never verify a bearer token solely in browser JS.
 * Provision BECK_PRIVATE_DIGITAL_ASSET_DIR outside this checkout and require
 * a private means of delivering the token to the purchaser. Do not log tokens.
 *
 * A response 'finish' is a stream completion, NOT independent proof that the
 * customer saved/opened the file. Real delivery needs customer confirmation.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { verifyStripeSignature } = require('./stripeWebhookProof');

const SKU = 'DISCORD-WEBHOOK-STARTER-KIT-001';
const ASSET_NAME = 'DISCORD-WEBHOOK-STARTER-KIT-001.zip';
const EXPECTED_LINK = 'plink_1U4FWbEGgEAnUFF9z0owuGVN';
const PRICE_MINOR = 7900;
const TTL_SECONDS = 15 * 60;
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const b64 = bytes => Buffer.from(bytes).toString('base64url');
function secretCheck(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw Error('DOWNLOAD_SIGNING_SECRET_REQUIRED_32_BYTES');
}
function secureSignature(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest();
}
function paidSessionFromSignedEvent({rawBody, stripeSignature, webhookSecret, expectedLivemode=true}) {
  const event = verifyStripeSignature(rawBody, stripeSignature, webhookSecret);
  if (!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))
    throw Error('STRIPE_EVENT_NOT_PAID_CHECKOUT');
  const s = event.data && event.data.object;
  if (!s || !/^cs_(test_)?[A-Za-z0-9_]{6,}$/.test(String(s.id||''))) throw Error('INVALID_SESSION_ID');
  if (event.livemode !== expectedLivemode || s.livemode !== expectedLivemode) throw Error('WRONG_STRIPE_MODE');
  if (s.payment_status !== 'paid' || s.mode !== 'payment') throw Error('NO_VERIFIED_PAYMENT');
  if (String(s.payment_link) !== EXPECTED_LINK) throw Error('PAYMENT_LINK_MISMATCH');
  if (s.currency !== 'nzd' || s.amount_total !== PRICE_MINOR) throw Error('PRICE_OR_CURRENCY_MISMATCH');
  if (!/^evt_[A-Za-z0-9_]{5,}$/.test(String(event.id||''))) throw Error('INVALID_EVENT_ID');
  return {sessionId:s.id, eventId:event.id, sku:SKU, livemode:expectedLivemode};
}
function issueFromSignedStripeWebhook(input) {
  const {downloadSecret,nowMs=Date.now(),...webhook} = input;
  secretCheck(downloadSecret);
  const paid = paidSessionFromSignedEvent(webhook);
  if (!Number.isSafeInteger(nowMs) || nowMs < 1) throw Error('INVALID_ISSUANCE_CLOCK');
  const claims = {v:1,scope:'private_digital_download',sku:SKU,order_id:paid.sessionId,
    event_id:paid.eventId,livemode:paid.livemode,iat:Math.floor(nowMs/1000),
    exp:Math.floor(nowMs/1000)+TTL_SECONDS};
  const body = b64(JSON.stringify(claims));
  const token = body+'.'+b64(secureSignature(downloadSecret,body));
  return {token,claims,delivery_state:'ENTITLEMENT_ISSUED_NOT_DELIVERED'};
}
function verifyToken(token,{downloadSecret,expectedLivemode=true,nowMs=Date.now()}) {
  secretCheck(downloadSecret);
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    throw Error('INVALID_DOWNLOAD_TOKEN');
  const [body,signature] = token.split('.');
  const actual=Buffer.from(signature,'base64url');
  const expected=secureSignature(downloadSecret,body);
  if (actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) throw Error('INVALID_DOWNLOAD_TOKEN_SIGNATURE');
  let c;
  try { c=JSON.parse(Buffer.from(body,'base64url').toString('utf8')); }
  catch { throw Error('INVALID_TOKEN_PAYLOAD'); }
  const now=Math.floor(nowMs/1000);
  if (c.v!==1 || c.scope!=='private_digital_download' || c.sku!==SKU ||
      !/^cs_(test_)?[A-Za-z0-9_]{6,}$/.test(String(c.order_id||'')) ||
      !/^evt_[A-Za-z0-9_]{5,}$/.test(String(c.event_id||'')) ||
      c.livemode!==expectedLivemode || !Number.isSafeInteger(c.iat) ||
      !Number.isSafeInteger(c.exp) || c.iat>now+5 || c.exp<=now ||
      c.exp-c.iat>TTL_SECONDS || c.exp<=c.iat) throw Error('DOWNLOAD_ENTITLEMENT_INVALID_OR_EXPIRED');
  return c;
}
function privateAssetPath(base) {
  if (!base || !path.isAbsolute(base)) throw Error('PRIVATE_ASSET_DIR_REQUIRED');
  const dir=fs.realpathSync(base);
  // The GitHub checkout is publicly readable. Private assets must never live inside it.
  if (dir===REPO_ROOT || dir.startsWith(REPO_ROOT+path.sep)) throw Error('ASSET_MUST_BE_OUTSIDE_PUBLIC_REPOSITORY');
  const file=path.join(dir,ASSET_NAME);
  if (fs.lstatSync(file).isSymbolicLink()) throw Error('SYMLINK_ASSET_FORBIDDEN');
  if (!fs.statSync(file).isFile() || fs.realpathSync(file)!==file) throw Error('INVALID_PRIVATE_ASSET');
  return file;
}
async function handle(req,res,{downloadSecret=process.env.BECK_DOWNLOAD_SIGNING_SECRET,
  privateDir=process.env.BECK_PRIVATE_DIGITAL_ASSET_DIR,
  expectedLivemode=true,onStreamFinished=()=>{}}={}) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='POST') {res.writeHead(405);res.end();return;}
  if (!downloadSecret || !privateDir) {res.writeHead(503);res.end('Private delivery not configured');return;}
  try {
    let size=0,chunks=[];
    for await(const piece of req){size+=piece.length;if(size>4096)throw Error('BODY_TOO_LARGE');chunks.push(piece);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const claims=verifyToken(input.token,{downloadSecret,expectedLivemode});
    const filename=privateAssetPath(privateDir);
    const info=fs.statSync(filename);
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition','attachment; filename="DISCORD-WEBHOOK-STARTER-KIT-001.zip"');
    res.setHeader('Content-Length',String(info.size));
    // Writable 'finish' does NOT establish customer receipt; never set FULFILLED from this.
    res.once('finish',()=>onStreamFinished({order_id:claims.order_id,
      sku:claims.sku,event_id:claims.event_id,delivery_state:'STREAM_FINISHED_CUSTOMER_RECEIPT_UNKNOWN'}));
    const stream=fs.createReadStream(filename,{flags:'r'});
    stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.destroy();});
    stream.pipe(res);
  } catch(e) {
    res.writeHead(e.message==='PRIVATE_ASSET_DIR_REQUIRED'?503:403);
    res.end('Download not authorised or unavailable');
  }
}
module.exports={paidSessionFromSignedEvent,issueFromSignedStripeWebhook,verifyToken,privateAssetPath,handle,SKU,EXPECTED_LINK};
