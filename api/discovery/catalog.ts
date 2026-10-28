// Explicit Vercel two-segment route. Delegate to BECK's existing read-only discovery adapter.
import discovery from "../../handlers/discovery.js";
export default async function handler(req:any,res:any) {
  return discovery(req,res);
}
