const checks = [
  ["homepage", "https://dreamledger.org/"],
  ["agentic-commerce", "https://dreamledger.org/agentic-commerce/"],
  ["quote-comparison", "https://dreamledger.org/quote-comparison/"],
  ["offers", "https://dreamledger.org/api/offers"],
  ["toll-manifest", "https://dreamledger.org/api/toll/v1/manifest"],
  ["healthz", "https://dreamledger.org/healthz"],
  ["carbon-schema", "https://dreamledger.org/.well-known/carbon-forward-schema.json"]
];
let failed = false;
for (const [name, url] of checks) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    let detail = "";
    if (name === "offers" && response.ok) {
      const data = JSON.parse(body);
      const offer = data.offers?.find(x => x.product_id === "QUOTE-COMPARE-49");
      if (!offer || offer.status !== "VERIFIED_AVAILABLE" || !offer.checkout_url || Number(offer.price_nzd) !== 49) {
        failed = true; detail = " | QUOTE-COMPARE-49 missing/invalid";
      } else detail = " | QUOTE-COMPARE-49 NZD 49 checkout configured";
    }
    if (name === "toll-manifest" && response.ok) {
      const data = JSON.parse(body);
      if (!Array.isArray(data.services) || !data.services.some(x => x.checkout_configured === true)) {
        failed = true; detail = " | no configured paid services";
      } else detail = ` | ${data.services.length} services`;
    }
    if (name === "healthz" && response.ok) {
      const data = JSON.parse(body);
      if (data.ok !== true) { failed = true; detail = " | health payload not ok"; }
      else detail = ` | service=${data.service ?? "unknown"} commit=${data.commit ?? "unknown"}`;
    }
    if (name === "carbon-schema" && response.ok) {
      const data = JSON.parse(body);
      if (!Array.isArray(data.required) || data.required.length !== 8) { failed = true; detail = " | schema required-field count mismatch"; }
      else detail = " | 8 required fields";
    }
    if (!response.ok) failed = true;
    console.log(`${failed && !response.ok ? "FAIL" : response.ok ? "PASS" : "FAIL"} ${name} HTTP ${response.status} bytes=${body.length}${detail}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name} ${error?.name ?? "Error"}: ${error?.message ?? String(error)}`);
  }
}
if (failed) process.exitCode = 1;
