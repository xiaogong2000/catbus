import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    return !!token;
  } catch {
    return false;
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Logged-in users visiting homepage → redirect to dashboard
  if (pathname === "/" && await hasValidSession(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protected routes: require auth
  if (pathname.startsWith("/dashboard")) {
    if (!await hasValidSession(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
