'use strict';
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '_catalog.json');
function load(){ return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
function send(res,status,body){ res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(body)); }
module.exports = function product(req,res){ if(req.method !== 'GET'){ return send(res,405,{error:'Method not allowed'}); } const id=decodeURIComponent(String(req.query && req.query.id || '').trim()); const data=load(); const product=data.products.find((item)=>String(item.id)===id); if(!product) return send(res,404,{error:'Product not found',id:id}); return send(res,200,product); };
