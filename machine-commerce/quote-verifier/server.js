import express from "express";
import { paymentMiddleware } from "@x402/express";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { verifyQuoteComparison } from "./quote-verifier.js";

const app = express();
app.use(express.json({limit:"256kb"}));

const PORT = Number(process.env.PORT || 4020);
const PAY_TO = process.env.PAY_TO;
const PRICE = process.env.X402_PRICE || "$0.02";

const facilitator = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator"
});
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:8453", new ExactEvmScheme());

if (PAY_TO) {
  app.use(paymentMiddleware({
    "POST /api/verify-quote": {
      accepts: {
        scheme:"exact",
        price:PRICE,
        network:"eip155:8453",
        payTo:PAY_TO
      },
      description:"Deterministic supplier-quote comparison with SHA-256 evidence receipt.",
      mimeType:"application/json",
      extensions:{
        ...declareDiscoveryExtension({
          input:{
            example:{
              quotes:[
                {supplier:"A",amount:100,currency:"NZD",line_items:[],timestamp:"2026-10-06T00:00:00Z"},
                {supplier:"B",amount:120,currency:"NZD",line_items:[],timestamp:"2026-10-06T00:00:00Z"}
              ],
              claimed_comparison:{cheapest:"A"}
            }
          },
          output:{
            example:{
              status:"VERIFIED",
              claimed_cheapest:"A",
              actual_cheapest:"A",
              deviation:0,
              reason:"Claimed cheapest matches deterministic minimum.",
              receipt_hash:"sha256",
              evidence_hash:"sha256"
            }
          }
        })
      }
    }
  },resourceServer));
}

app.get("/healthz",(_req,res)=>res.json({
  status:"ok",
  service:"dreamledger-deterministic-quote-verifier",
  payment:PAY_TO ? "x402_base_mainnet" : "blocked_missing_pay_to",
  price:PRICE,
  economic_truth:"UNVERIFIED"
}));

app.post("/api/verify-quote",(req,res)=>{
  if(!PAY_TO) return res.status(503).json({error:"MONETIZATION_NOT_CONFIGURED",missing:"PAY_TO",economic_truth:"UNVERIFIED"});
  try {
    const verdict=verifyQuoteComparison(req.body);
    return res.json({
      ...verdict,
      receipt_format:"SHA256_CANONICAL_JSON",
      payment_settlement_observed_by:req.header("PAYMENT-RESPONSE") ? "X402_PAYMENT_RESPONSE" : "UNOBSERVED",
      payment_response:req.header("PAYMENT-RESPONSE") || null
    });
  } catch(error) {
    return res.status(400).json({error:String(error?.message || error),economic_truth:"UNVERIFIED"});
  }
});

app.listen(PORT,"0.0.0.0",()=>console.log("QUOTE_VERIFIER_READY port="+PORT+" pay_to_configured="+Boolean(PAY_TO)));
