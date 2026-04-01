// Route protection middleware — redirects unauthenticated users to /login
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Protect all main app routes
  if (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/parties") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/cashflow") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname === "/"
  ) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.nextUrl));
    }
  }

  // Redirect already-logged-in users away from the login page
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
