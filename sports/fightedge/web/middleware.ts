import { NextRequest, NextResponse } from "next/server";

const CANONICAL_BASE = "https://dreamledger.org/fightedge/";

/**
 * FightEdge is part of the DreamLedger public service wall.
 * Every Render-hosted FightEdge instance is a compatibility redirect only.
 * The canonical experience is served by DreamLedger's existing static site.
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host.endsWith(".onrender.com")) {
    return NextResponse.next();
  }

  // The first-party site is a static service wall, not the old Next.js route tree.
  // Map old deep links to the closest useful section instead of creating 404s.
  const path = request.nextUrl.pathname.toLowerCase();
  const destination = new URL(CANONICAL_BASE);
  destination.search = request.nextUrl.search;
  destination.hash = /analysis|results|pundit/.test(path) ? "#evidence" : "#catalog";
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/:path*"],
};
