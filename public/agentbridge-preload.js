'use strict';
const http=require('http');
const agentBridge=require('../BEC-PRIME/runtime/AgentBridge');
const bridgeRail=require('../BEC-PRIME/runtime/BridgeRail');
const productionWorker=require('../BEC-PRIME/runtime/ProductionBridgeWorker');

if(!global.__dreamledgerAgentBridgePreload){
  const originalCreateServer=http.createServer;
  http.createServer=function agentBridgeCreateServer(handler){
    const wrapped=async function agentBridgeHandler(req,res){
      const requestPath=String(req.url||'').split('?')[0];
      if(requestPath.startsWith('/api/agent-bridge/rail')){
        try{
          const handled=await bridgeRail.handle(req,res);
          if(handled)return;
        }catch(err){
          if(!res.writableEnded){
            res.statusCode=err&&err.statusCode?err.statusCode:500;
            res.setHeader('Content-Type','application/json; charset=utf-8');
            res.setHeader('Cache-Control','no-store');
            res.end(JSON.stringify({error:err&&err.message?err.message:'Bridge rail route failed'}));
          }
          return;
        }
      }
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
    const server=originalCreateServer.call(this,wrapped);
    const originalListen=server.listen.bind(server);
    server.listen=function agentBridgeListen(...args){
      const callback=typeof args[args.length-1]==='function'?args[args.length-1]:null;
      if(callback){
        args[args.length-1]=function(){
          callback.apply(this,arguments);
          try{
            const address=server.address();
            const port=typeof address==='object'&&address?address.port:process.env.PORT;
            productionWorker.start({port,workerId:process.env.BEC_WORKER_ID||'render-worker'});
          }catch(err){
            console.error('[ProductionBridgeWorker] startup failed',err&&err.message?err.message:err);
          }
        };
      }
      const result=originalListen(...args);
      if(!callback){
        try{
          const address=server.address();
          const port=typeof address==='object'&&address?address.port:process.env.PORT;
          productionWorker.start({port,workerId:process.env.BEC_WORKER_ID||'render-worker'});
        }catch(err){
          console.error('[ProductionBridgeWorker] startup failed',err&&err.message?err.message:err);
        }
      }
      return result;
    };
    return server;
  };
  global.__dreamledgerAgentBridgePreload=true;
}
