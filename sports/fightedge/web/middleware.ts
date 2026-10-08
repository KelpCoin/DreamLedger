import { NextRequest, NextResponse } from "next/server";

const LEGACY_HOST = "fightedge-web.onrender.com";
const CANONICAL_BASE = "https://dreamledger.org/fightedge";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();

  // Keep the old Render hostname as a safe redirect, not a second product surface.
  if (host !== LEGACY_HOST) {
    return NextResponse.next();
  }

  const incomingPath = request.nextUrl.pathname;
  const suffix = incomingPath === "/" ? "" : incomingPath;
  const destination = new URL(CANONICAL_BASE + suffix + request.nextUrl.search);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/:path*"],
};
