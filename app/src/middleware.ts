import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
);

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/line/webhook"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/") && !pathname.startsWith("/(admin)")) {
    if (
      pathname === "/" ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/reservations") ||
      pathname.startsWith("/customers") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/print")
    ) {
      const token = request.cookies.get("pckyo_token")?.value;
      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      try {
        await jwtVerify(token, SECRET);
      } catch {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  if (pathname.startsWith("/api/") && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get("pckyo_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await jwtVerify(token, SECRET);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
