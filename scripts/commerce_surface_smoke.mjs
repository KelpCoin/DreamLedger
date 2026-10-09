const checks = [
  ["homepage", "https://dreamledger.org/"],
  ["agentic-commerce", "https://dreamledger.org/agentic-commerce/"],
  ["quote-comparison", "https://dreamledger.org/quote-comparison/"],
  ["toll-manifest", "https://dreamledger.org/api/toll/v1/manifest"],
  ["healthz", "https://dreamledger.org/healthz"],
  ["carbon-schema", "https://dreamledger.org/.well-known/carbon-forward-schema.json"],
  ["carbon-schema-public-path", "https://dreamledger.org/public/carbon-schema.json"]
];
let failed = false;
for (const [name, url] of checks) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    let detail = "";
    if (name === "quote-comparison" && response.ok) {
      if (!body.includes("Free quote intake") || !body.includes("free_initialize") || body.includes("NZ$49 one-time") || body.includes("Stripe checkout session ID required")) {
        failed = true; detail = " | free intake contract missing or paid wall remains";
      } else detail = " | free intake contract present";
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
    if ((name === "carbon-schema" || name === "carbon-schema-public-path") && response.ok) {
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

async function testFreeQuoteIntake() {
  const base = "https://wbwgroygjeyukkspnqiy.supabase.co";
  const fn = base + "/functions/v1/quote-intake";
  const key = "sb_publishable_O5JRD67KaU3SA9dFq-JIuQ_Pzs8pedj";
  const files = [
    { name: "smoke-a.csv", body: "Supplier,Grand total,Lead time\\nSupplier A,Grand total: NZD 100.00,5 days\\n" },
    { name: "smoke-b.csv", body: "Supplier,Grand total,Lead time\\nSupplier B,Grand total: NZD 125.00,7 days\\n" }
  ];
  const api = async (body) => {
    const res = await fetch(fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: key }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("intake HTTP " + res.status + " " + (data.error || ""));
    return data;
  };
  try {
    const init = await api({ action: "free_initialize", files: files.map(x => ({ name: x.name })) });
    if (!init.ok || !init.intake_id || !Array.isArray(init.uploads) || init.uploads.length !== 2) throw new Error("initialize did not return structured upload instructions");
    const prepared = [];
    for (let i = 0; i < files.length; i++) {
      const u = init.uploads[i];
      const res = await fetch(base + "/storage/v1/object/upload/sign/" + encodeURIComponent(u.path) + "?token=" + encodeURIComponent(u.token), {
        method: "PUT", headers: { "Content-Type": "text/csv" }, body: files[i].body, signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error("test upload HTTP " + res.status);
      prepared.push({ path: u.path, name: files[i].name, size: new TextEncoder().encode(files[i].body).length });
    }
    const result = await api({ action: "free_finalize", intake_id: init.intake_id, requirements: "CI fixture only: compare sample supplier quotes", files: prepared, share_anonymized: false });
    if (!result.ok || result.comparison?.comparison_status !== "COMPLETE" || result.comparison?.comparable_totals !== 2 || result.comparison?.evidence_type !== "QUOTED_OFFER") {
      throw new Error("unexpected structured comparison response: " + JSON.stringify(result.comparison || result.error));
    }
    if (result.oracle_ingestion?.status !== "NOT_REQUESTED") throw new Error("smoke test unexpectedly requested public publication");
    console.log("PASS free-quote-intake HTTP 200 structured comparison; 2 totals; no public publication");
  } catch (error) {
    failed = true;
    console.log("FAIL free-quote-intake " + (error?.message ?? String(error)));
  }
}
await testFreeQuoteIntake();

if (failed) process.exitCode = 1;
