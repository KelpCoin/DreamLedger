'use strict';

const fs = require('fs');
const path = require('path');

const DATA_ROOT = process.env.DREAMIEZ_DATA_DIR || '/tmp/dreamledger-account';
const USERS = path.join(DATA_ROOT, 'users.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(USERS, 'utf8'));
  } catch {
    return [];
  }
}

function write(users) {
  fs.mkdirSync(path.dirname(USERS), { recursive: true });
  const tmp = USERS + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2) + '\n');
  fs.renameSync(tmp, USERS);
}

module.exports = { read, write };
