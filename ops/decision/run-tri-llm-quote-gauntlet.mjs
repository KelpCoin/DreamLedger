import { readFile, writeFile } from 'node:fs/promises';
import { runQuoteGauntlet } from './tri-llm-quote-gauntlet.mjs';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath) {
  console.error('Usage: node ops/decision/run-tri-llm-quote-gauntlet.mjs <input.json> [result.json]');
  process.exitCode = 2;
} else {
  try {
    const data = JSON.parse(await readFile(inputPath, 'utf8'));
    if (!data || typeof data.raw_input !== 'string' || !data.context_manifest) {
      throw new Error('Input must contain raw_input and context_manifest');
    }
    const result = await runQuoteGauntlet({ rawInput: data.raw_input, contextManifest: data.context_manifest });
    const output = JSON.stringify(result, null, 2) + '\n';
    if (outputPath) await writeFile(outputPath, output, { mode: 0o600 });
    console.log(output);
    process.exitCode = result.status === 'REVIEW_REQUIRED' ? 0 : 1;
  } catch (error) {
    console.error('TRI_LLM_FAIL_CLOSED:', String(error.message || error));
    process.exitCode = 2;
  }
}
