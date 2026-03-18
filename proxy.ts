import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type Role = 'candidate' | 'company' | null;

function getRole(request: NextRequest): Role {
  const value = request.cookies.get('th_role')?.value;
  if (value === 'candidate' || value === 'company') return value;
  return null;
}

export function proxy(request: NextRequest) {
  const role = getRole(request);
  const { pathname } = request.nextUrl;

  if (!role) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/candidate') && role === 'company') {
    return NextResponse.redirect(new URL('/company', request.url));
  }

  if (pathname.startsWith('/company') && role === 'candidate') {
    return NextResponse.redirect(new URL('/candidate', request.url));
  }

  if ((pathname === '/login/candidate' || pathname === '/signup/candidate') && role === 'company') {
    return NextResponse.redirect(new URL('/company', request.url));
  }

  if ((pathname === '/login/recruiter' || pathname === '/signup/recruiter') && role === 'candidate') {
    return NextResponse.redirect(new URL('/candidate', request.url));
  }

  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL(role === 'company' ? '/company' : '/candidate', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/candidate/:path*',
    '/company/:path*',
    '/dashboard',
    '/login/candidate',
    '/login/recruiter',
    '/signup/candidate',
    '/signup/recruiter',
  ],
};

