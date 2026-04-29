// HTTP Basic Auth for the Coeo COGS app.
// Credentials come from environment variables (BASIC_AUTH_USER / BASIC_AUTH_PASSWORD).
// Placement: src/middleware.ts (this project uses src/).

import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};

export default function middleware(request: NextRequest) {
  const basicAuth = request.headers.get("authorization");

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    const expectedUser = process.env.BASIC_AUTH_USER;
    const expectedPwd = process.env.BASIC_AUTH_PASSWORD;

    if (user === expectedUser && pwd === expectedPwd) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="COEO Profitability"',
    },
  });
}
