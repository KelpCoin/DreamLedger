'use strict';
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '_catalog.json');
function load(){ return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
function send(res,status,body){ res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(body)); }
module.exports = function products(req,res){ if(req.method !== 'GET'){ return send(res,405,{error:'Method not allowed'}); } const data=load(); return send(res,200,{schema:data.schema,product_count:data.product_count,products:data.products}); };
