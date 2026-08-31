'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'compiled', 'website');

function patch(file, marker, script) {
  const target = path.join(SITE, file);
  if (!fs.existsSync(target)) throw new Error(`ACCOUNT_SURFACE_MISSING:${file}`);
  let html = fs.readFileSync(target, 'utf8');
  if (!html.includes(marker)) {
    const insertion = `<script>${script}</script>`;
    if (html.includes('</body>')) html = html.replace('</body>', insertion + '</body>');
    else html += insertion;
    fs.writeFileSync(target, html, 'utf8');
  }
  const final = fs.readFileSync(target, 'utf8');
  if (!final.includes(marker)) throw new Error(`ACCOUNT_CONTRACT_PATCH_FAILED:${file}`);
}

patch(
  'login.html',
  '/api/account/login',
  'document.getElementById("login")&&document.getElementById("login").addEventListener("submit",async function(e){e.preventDefault();var m=document.getElementById("msg");try{var r=await fetch("/api/account/login",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:document.getElementById("email").value,password:document.getElementById("password").value})});var d=await r.json();if(!r.ok)throw Error(d.error||"Login failed");location.href=d.next||"/account.html"}catch(x){if(m){m.className="error";m.textContent=x.message}}});'
);

patch(
  'register.html',
  '/api/account/register',
  'document.getElementById("register")&&document.getElementById("register").addEventListener("submit",async function(e){e.preventDefault();var m=document.getElementById("msg");try{var r=await fetch("/api/account/register",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById("name").value,email:document.getElementById("email").value,password:document.getElementById("password").value})});var d=await r.json();if(!r.ok)throw Error(d.error||"Registration failed");location.href=d.next||"/account.html"}catch(x){if(m){m.className="error";m.textContent=x.message}}});'
);

patch(
  'account.html',
  '/api/account/me',
  '(async function(){var s=document.getElementById("state");try{var r=await fetch("/api/account/me",{credentials:"include",cache:"no-store"});var d=await r.json();if(d.authenticated){s.textContent="Signed in as "+(d.account.email||d.account.name||"your DreamLedger account")}else{s.innerHTML="Please <a href=\\"/login.html\\">log in</a> to view your account."}}catch(e){s.textContent="Account service unavailable."}})();'
);

console.log('PASS: primary DreamLedger account contracts repaired after surface compilation.');
