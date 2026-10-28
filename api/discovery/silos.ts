// Explicit Vercel two-segment route. Delegate to the same registered CUBE silo adapter.
import discovery from "../../handlers/discovery.js";
export default async function handler(req:any,res:any) {
  return discovery(req,res);
}
