'use strict';
const http=require('http');
const agentBridge=require('../BEC-PRIME/runtime/AgentBridge');

if(!global.__dreamledgerAgentBridgePreload){
  const originalCreateServer=http.createServer;
  http.createServer=function agentBridgeCreateServer(handler){
    const wrapped=async function agentBridgeHandler(req,res){
      const requestPath=String(req.url||'').split('?')[0];
      if(requestPath.startsWith('/api/agent-bridge')){
        try{
          const handled=await agentBridge.handle(req,res);
          if(handled)return;
        }catch(err){
          if(!res.writableEnded){
            res.statusCode=err&&err.statusCode?err.statusCode:500;
            res.setHeader('Content-Type','application/json; charset=utf-8');
            res.setHeader('Cache-Control','no-store');
            res.end(JSON.stringify({error:err&&err.message?err.message:'AgentBridge route failed'}));
          }
          return;
        }
      }
      return handler(req,res);
    };
    return originalCreateServer.call(this,wrapped);
  };
  global.__dreamledgerAgentBridgePreload=true;
}
