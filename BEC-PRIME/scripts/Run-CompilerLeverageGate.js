'use strict';

const fs = require('fs');
const path = require('path');
const { gate } = require('../compiler/LeverageGauntlet');

(async () => {
  const root = path.join(__dirname, '..');
  const proofRoot = path.join(root, 'data', 'proofs');
  const sourcePong = path.join(root, 'test-vectors', 'pong.html');
  const compiledPong = path.join(root, 'compiled', 'website', 'compiler-proof', 'pong.html');
  const compiledHome = path.join(root, 'compiled', 'website', 'index.html');

  fs.mkdirSync(path.dirname(compiledPong), { recursive: true });
  fs.copyFileSync(sourcePong, compiledPong);

  const pong = await gate({ artifact: compiledPong, kind: 'html', compiler: 'BrownEyeCortex-UniversalCompiler' });
  const home = await gate({ artifact: compiledHome, kind: 'html', compiler: 'BrownEyeCortex-SurfaceCompiler' });

  const result = {
    schema: 'BEC-COMPILER-LEVERAGE-RUN/v1',
    status: pong.verdict === 'PASS' && home.verdict === 'PASS' ? 'PASS' : 'FAIL',
    pong,
    homepage: home,
    generated_at: new Date().toISOString()
  };

  fs.mkdirSync(proofRoot, { recursive: true });
  fs.writeFileSync(path.join(proofRoot, 'compiler-leverage-latest.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
})();
