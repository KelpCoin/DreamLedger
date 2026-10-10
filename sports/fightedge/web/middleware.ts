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

  const incomingPath = request.nextUrl.pathname;
  const suffix = incomingPath === "/" ? "" : incomingPath.replace(/^\/+/, "");
  const destination = new URL(CANONICAL_BASE + suffix + request.nextUrl.search);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/:path*"],
};
