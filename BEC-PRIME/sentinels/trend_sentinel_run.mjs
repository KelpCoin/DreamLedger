#!/usr/bin/env node
/**
 * Global trend sentinel for DreamLedger's existing demand → Gauntlet pipeline.
 * Reads public Google Trends RSS feeds, emits evidence-linked candidates only.
 * Trend attention is NOT purchase intent, a validated buyer, a SKU approval, or revenue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN_ID = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const NOW = new Date().toISOString();
const MARKETS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'CA', label: 'Canada' },
  { code: 'SG', label: 'Singapore' },
];

const VERTICALS = [
  { id: 'collectibles-toys', silo_hint: 'collectibles', terms: ['labubu','pop mart','blind box','vinyl figure','plush','pokemon card','trading card','magic the gathering','mtg card','lego set','collectible'] },
  { id: 'gaming', silo_hint: 'gaming', terms: ['video game','gaming','steam game','game release','nintendo','playstation','xbox','pokemon game'] },
  { id: 'beauty-personal-care', silo_hint: 'beauty', terms: ['skincare','makeup','perfume','beauty','haircare','sunscreen','fragrance'] },
  { id: 'fashion-apparel', silo_hint: 'fashion', terms: ['sneaker','streetwear','fashion','handbag','apparel','outfit','jacket'] },
  { id: 'home-living', silo_hint: 'home', terms: ['home decor','furniture','mattress','bedding','kitchen appliance','vacuum','storage'] },
  { id: 'consumer-tech', silo_hint: 'technology', terms: ['iphone','smartphone','laptop','gpu','graphics card','headphones','smartwatch','robot vacuum'] },
  { id: 'ai-software-agents', silo_hint: 'ai-software', terms: ['ai agent','artificial intelligence','openai','anthropic','claude','chatgpt','automation','mcp server','agentic commerce'] },
  { id: 'creator-digital-assets', silo_hint: 'creator-tools', terms: ['canva template','notion template','video editing','creator tools','digital product','font','preset','streaming setup'] },
  { id: 'small-business-operations', silo_hint: 'business-ops', terms: ['small business software','invoice automation','accounting software','crm software','inventory management','business automation'] },
  { id: 'b2b-procurement', silo_hint: 'procurement', terms: ['supplier','wholesale','bulk order','procurement','shipping rates','freight','packaging supplier','quote comparison'] },
  { id: 'cybersecurity-trust', silo_hint: 'security', terms: ['cybersecurity','data breach','phishing','passkey','identity verification','fraud prevention','ai security'] },
  { id: 'pets', silo_hint: 'pets', terms: ['dog food','cat food','pet carrier','pet camera','pet insurance','pet accessories'] },
  { id: 'fitness-outdoors', silo_hint: 'fitness-outdoors', terms: ['running shoes','walking pad','fitness tracker','camping gear','hiking gear','home gym','cycling'] },
  { id: 'food-kitchen', silo_hint: 'food-kitchen', terms: ['air fryer','protein snacks','meal prep','coffee maker','kitchen gadget','recipe'] },
  { id: 'travel-experiences', silo_hint: 'travel', terms: ['travel deals','hotel deals','flight deals','luggage','travel accessories','tour tickets'] },
  { id: 'events-entertainment', silo_hint: 'events', terms: ['concert tickets','festival','movie release','streaming','anime','tv series','celebrity'] },
  { id: 'sports-fandom', silo_hint: 'sports-fandom', terms: ['football jersey','sports cards','nba','nfl','f1','cricket','rugby','tennis'] },
  { id: 'education-career-tools', silo_hint: 'learning-tools', terms: ['study app','language learning','certification exam','resume template','interview prep','online course'] },
  { id: 'automotive', silo_hint: 'automotive', terms: ['used car','ev charger','dash cam','car accessories','tyres','car detailing'] },
  { id: 'sustainability-energy', silo_hint: 'energy', terms: ['solar panels','power bill','electricity rates','home battery','heat pump','energy efficiency'] },
  { id: 'finance-consumer', silo_hint: 'finance-tools', terms: ['mortgage rates','budget app','personal finance app','currency exchange','tax software'] },
  { id: 'local-services', silo_hint: 'services', terms: ['plumber','electrician','cleaning service','moving company','home repair','lawn care'] },
];

function decodeXml(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>','i'));
  return m ? decodeXml(m[1]) : '';
}
async function getFeed(market) {
  const url = `https://trends.google.com/trending/rss?geo=${market.code}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'DreamLedgerTrendSentinel/1.0' } });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const items = [...body.matchAll(/<item(?:\\s[^>]*)?>([\\s\\S]*?)<\\/item>/gi)].map(m => {
      const item = m[1];
      const title = tag(item, 'title');
      return { title, link: tag(item, 'link'), published_at: tag(item, 'pubDate'), approx_traffic: tag(item, 'ht:approx_traffic'), related_queries: [...item.matchAll(/<ht:news_item_title>([\\s\\S]*?)<\\/ht:news_item_title>/gi)].map(x => decodeXml(x[1])).slice(0, 5) };
    }).filter(x => x.title);
    return { market: market.code, market_label: market.label, source_url: url, fetched_at: new Date().toISOString(), status: 'OK', items };
  } catch (e) {
    return { market: market.code, market_label: market.label, source_url: url, fetched_at: new Date().toISOString(), status: 'UNAVAILABLE', error: String(e.message || e), items: [] };
  } finally { clearTimeout(timeout); }
}
function classify(item, market) {
  const text = (item.title + ' ' + item.related_queries.join(' ')).toLowerCase();
  return VERTICALS.filter(v => v.terms.some(term => text.includes(term))).map(v => ({
    vertical_id: v.id, silo_hint: v.silo_hint, trend_title: item.title, market: market.code,
    source_url: item.link || market.source_url, feed_url: market.source_url,
    published_at: item.published_at || null, approx_traffic: item.approx_traffic || null,
    observed_at: NOW, signal_type: 'PUBLIC_SEARCH_TREND', evidentiary_status: 'UNVERIFIED_ATTENTION_SIGNAL',
    commerce_status: 'NOT_BUYER_EVIDENCE', gauntlet_status: 'NOT_SUBMITTED',
  }));
}
const feeds = await Promise.all(MARKETS.map(getFeed));
const candidates = feeds.flatMap(feed => feed.items.flatMap(item => classify(item, feed)));
const grouped = new Map();
for (const c of candidates) {
  const key = c.vertical_id + '|' + c.trend_title.toLowerCase();
  if (!grouped.has(key)) grouped.set(key, { ...c, markets: [], corroborating_sources: [], observed_market_count: 0 });
  const g = grouped.get(key);
  if (!g.markets.includes(c.market)) g.markets.push(c.market);
  if (!g.corroborating_sources.includes(c.source_url)) g.corroborating_sources.push(c.source_url);
  g.observed_market_count = g.markets.length;
}
const rows = [...grouped.values()].map(g => ({
  ...g,
  candidate_priority: g.observed_market_count >= 3 ? 'RESEARCH_PRIORITY_1' : g.observed_market_count === 2 ? 'RESEARCH_PRIORITY_2' : 'WATCH',
  next_gate: 'CORROBORATE_COMMERCIAL_INTENT_THEN_EXISTING_FULFILLMENT_AND_GAUNTLET',
  silo_birth_authorized: false,
  sku_creation_authorized: false,
  payment_or_revenue_claim: false,
}));
const report = {
  schema: 'BEC-PRIME/GLOBAL-TREND-SENTINEL/v1', run_id: RUN_ID, observed_at: NOW,
  markets_requested: MARKETS.map(m => m.code), markets_succeeded: feeds.filter(f => f.status === 'OK').map(f => f.market),
  markets_failed: feeds.filter(f => f.status !== 'OK').map(f => ({ market: f.market, error: f.error })),
  source: 'Google Trends public trending RSS; trend attention is not search-volume proof or buyer intent',
  verticals_monitored: VERTICALS.map(v => ({ vertical_id: v.id, silo_hint: v.silo_hint })),
  feed_item_count: feeds.reduce((n, f) => n + f.items.length, 0),
  classified_candidate_count: rows.length, candidates: rows,
  rules: {
    no_invented_demand: true, no_automatic_silo_birth: true, no_automatic_sku_approval: true,
    existing_Gauntlet_required: true, settled_external_payment_required_for_revenue: true,
    promote_only_after: ['independent commercial intent evidence', 'specific buyer and economic friction', 'feasible fulfillment', 'Gauntlet pass', 'Authority Gate', 'live checkout proof'],
  },
};
const out = path.join(ROOT, 'ops', 'demand');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'latest-trends.json'), JSON.stringify(report, null, 2) + '\n');
const archive = path.join(ROOT, 'AGENT_BUS', 'sentinel-reports');
fs.mkdirSync(archive, { recursive: true });
fs.writeFileSync(path.join(archive, `global-trends-${RUN_ID}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ schema: report.schema, run_id: RUN_ID, markets_succeeded: report.markets_succeeded, markets_failed: report.markets_failed, feed_item_count: report.feed_item_count, classified_candidate_count: report.classified_candidate_count, silo_birth_authorized: false, sku_creation_authorized: false }, null, 2));
