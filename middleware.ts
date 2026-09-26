import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes — pass through (auth handled per-route)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Dashboard routes — require auth (will be enforced via NextAuth in Phase 5)
  // For now, pass through
  if (pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
