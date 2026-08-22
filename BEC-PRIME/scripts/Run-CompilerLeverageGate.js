'use strict';

const fs = require('fs');
const path = require('path');
const { gate } = require('../compiler/LeverageGauntlet');
const { load: loadLeverageRegistry } = require('../cortex/LeverageRegistryCompiler');

(async () => {
  const root = path.join(__dirname, '..');
  const proofRoot = path.join(root, 'data', 'proofs');
  const sourcePong = path.join(root, 'test-vectors', 'pong.html');
  const compiledPong = path.join(root, 'compiled', 'website', 'compiler-proof', 'pong.html');
  const compiledHome = path.join(root, 'compiled', 'website', 'index.html');

  const leverageRegistry = loadLeverageRegistry();
  const registryPass = leverageRegistry.entries.length === 100;

  fs.mkdirSync(path.dirname(compiledPong), { recursive: true });
  fs.copyFileSync(sourcePong, compiledPong);

  const pong = await gate({ artifact: compiledPong, kind: 'html', compiler: 'BrownEyeCortex-UniversalCompiler' });
  const home = await gate({ artifact: compiledHome, kind: 'html', compiler: 'BrownEyeCortex-SurfaceCompiler' });

  const result = {
    schema: 'BEC-COMPILER-LEVERAGE-RUN/v2',
    status: registryPass && pong.verdict === 'PASS' && home.verdict === 'PASS' ? 'PASS' : 'FAIL',
    leverage_registry: { range: leverageRegistry.range, count: leverageRegistry.entries.length, verdict: registryPass ? 'PASS' : 'FAIL' },
    pong,
    homepage: home,
    generated_at: new Date().toISOString()
  };

  fs.mkdirSync(proofRoot, { recursive: true });
  fs.writeFileSync(path.join(proofRoot, 'compiler-leverage-latest.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
})();
