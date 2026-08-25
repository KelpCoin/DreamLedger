'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const target = path.join(__dirname, 'SurfaceCompiler.js');
let source = fs.readFileSync(target, 'utf8');

const startToken = 'function catalogPage(){return `';
const endMarker = '\n\n[TEMPLATE,MANIFEST,OFFERS,IP,PRODUCTS,NEWS,AUCTIONS,CINEMA_TEMPLATE,DIGITAL_TEMPLATE].forEach(must);';
const start = source.indexOf(startToken);
const marker = source.indexOf(endMarker, start + startToken.length);

if (start < 0 || marker < 0) {
  throw new Error('SurfaceCompilerRuntimeFix: catalogPage boundaries not found');
}

const openEnd = start + startToken.length;
const closeStart = marker - 2;
if (closeStart <= openEnd || source.slice(closeStart, marker) !== '`}') {
  throw new Error('SurfaceCompilerRuntimeFix: catalogPage closing delimiter not found');
}

let body = source.slice(openEnd, closeStart);
body = body.replace(/`/g, '\\`');
body = body.replace(/\$\{/g, '\\${');

const fixed = source.slice(0, openEnd) + body + source.slice(closeStart);
if (!fixed.includes('function catalogPage(){return `')) {
  throw new Error('SurfaceCompilerRuntimeFix: transformed compiler is invalid');
}

const runtimeModule = new Module(target, module.parent);
runtimeModule.filename = target;
runtimeModule.paths = Module._nodeModulePaths(path.dirname(target));
runtimeModule._compile(fixed, target);

require('./PublicSurfaceAugment.js');
