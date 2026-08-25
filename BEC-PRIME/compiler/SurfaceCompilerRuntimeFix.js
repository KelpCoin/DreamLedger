'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const target = path.join(__dirname, 'SurfaceCompiler.js');
let source = fs.readFileSync(target, 'utf8');

const startToken = 'function catalogPage(){return `';
const endToken = '`}\n\n[TEMPLATE,MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS,CINEMA_TEMPLATE,DIGITAL_TEMPLATE].forEach(must);';
const start = source.indexOf(startToken);
const end = source.indexOf(endToken, start + startToken.length);

if (start < 0 || end < 0) {
  throw new Error('SurfaceCompilerRuntimeFix: catalogPage template boundaries not found');
}

const openEnd = start + startToken.length;
let body = source.slice(openEnd, end);
body = body.replace(/`/g, '\\`');
body = body.replace(/\$\{/g, '\\${');

const fixed = source.slice(0, openEnd) + body + source.slice(end);

if (!fixed.includes('function catalogPage(){return `')) {
  throw new Error('SurfaceCompilerRuntimeFix: transformed compiler is invalid');
}

const runtimeModule = new Module(target, module.parent);
runtimeModule.filename = target;
runtimeModule.paths = Module._nodeModulePaths(path.dirname(target));
runtimeModule._compile(fixed, target);
