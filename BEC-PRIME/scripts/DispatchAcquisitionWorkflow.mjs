#!/usr/bin/env node
'use strict';

const token = String(process.env.GITHUB_DISPATCH_TOKEN || '').trim();
if (!token) {
  console.error('GITHUB_DISPATCH_TOKEN is required.');
  process.exit(2);
}

const repo = String(process.env.GITHUB_REPOSITORY || 'KelpCoin/DreamLedger').trim();
const workflow = String(process.env.GITHUB_WORKFLOW || 'acquire-catalog-discord.yml').trim();
const ref = String(process.env.GITHUB_REF_NAME || 'main').trim();
const offer = String(process.env.ACQUISITION_OFFER || 'CMD-DIAG-29').trim();
const target = String(process.env.ACQUISITION_TARGET || '').trim();
const approval = String(process.env.ACQUISITION_APPROVAL || '').trim();

if (!target) {
  console.error('ACQUISITION_TARGET is required.');
  process.exit(2);
}
if (approval !== 'APPROVED') {
  console.error('ACQUISITION_APPROVAL must be APPROVED.');
  process.exit(2);
}

const url =
  'https://api.github.com/repos/' +
  repo +
  '/actions/workflows/' +
  encodeURIComponent(workflow) +
  '/dispatches';

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2026-03-10',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ref,
    inputs: {
      offer,
      target,
      approval
    }
  })
});

if (!response.ok) {
  const body = await response.text();
  console.error('GitHub dispatch failed: ' + response.status + ' ' + body.slice(0, 1000));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'DISPATCH_ACCEPTED',
  repository: repo,
  workflow,
  ref,
  offer,
  approval: 'APPROVED'
}, null, 2));
