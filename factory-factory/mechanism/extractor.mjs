#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const input = process.argv[2];
if (!input) throw new Error("usage: node extractor.mjs <run.json>");
const run = JSON.parse(fs.readFileSync(input, "utf8"));
const verified = run.truth_status === "VERIFIED" && run.external_buyer === true && run.settled_payment === true && run.independent_proof === true;
const mechanism = {
  eligible: verified,
  rule: verified ? "PROMOTE_CANDIDATE" : "HOLD",
  source_run: run.run_id ?? null,
  cell_id: run.cell_id ?? null,
  mechanism_hash: crypto.createHash("sha256").update(JSON.stringify(run)).digest("hex")
};
process.stdout.write(JSON.stringify(mechanism, null, 2) + "\n");
