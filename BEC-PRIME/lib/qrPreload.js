'use strict';
const http=require('http');
const qr=require('./qrEngine');
const original=http.createServer;
http.createServer=function(options,listener){if(typeof options==='function'){listener=options;options=undefined;}return original.call(http,options,async(req,res)=>{const url=String(req.url||'/').split('?')[0];try{if(await qr.handle(req,res,url))return;}catch(e){if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'QR runtime failure'}));}return;}return listener(req,res);});};
