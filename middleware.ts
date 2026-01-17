import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/signin(.*)',
  '/sign-up(.*)',
  '/binder-tracking',
  '/ai-card-identification',
  '/managing-inventory',
  '/about',
])

export default clerkMiddleware(async (auth, req) => {
  // In development, fix the x-forwarded-host header if it's mismatched
  if (process.env.NODE_ENV === 'development') {
    const origin = req.headers.get('origin')
    const xForwardedHost = req.headers.get('x-forwarded-host')
    const origin_url = origin ? new URL(origin).host : null

    // If we have a mismatch and a NEONBINDER_BROWSER_URL, fix it
    if (xForwardedHost && origin_url && xForwardedHost !== origin_url) {
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-forwarded-host', origin_url)
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      return response
    }
  }

  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
