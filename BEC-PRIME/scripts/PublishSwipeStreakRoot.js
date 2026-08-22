'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const source = path.join(root, 'compiled', 'website', 'swipe-streak', 'index.html');
const target = path.join(root, 'compiled', 'website', 'index.html');
if (!fs.existsSync(source)) throw new Error('Swipe Streak surface missing: ' + source);
fs.copyFileSync(source, target);
console.log(JSON.stringify({ status: 'PASS', surface: 'swipe-streak', source, target }));
