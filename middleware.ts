import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseReqResClient } from "@/lib/supabase/server-client";

export async function middleware(request: NextRequest) {
  // Get the origin from the request headers
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = [
    'http://localhost:3000',
    'https://64b3466d-48ab-43ac-94e1-df5a0c65600c-00-3dcvk8y4qe4v6.kirk.replit.dev',
  ];

  // Create the response with the original headers
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add CORS headers if origin is allowed
  if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
  }

  const supabase = await createSupabaseReqResClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Redirects to sign-in when attempting to visit the landing page
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/_next/:path*", "/api/:path*"]
}