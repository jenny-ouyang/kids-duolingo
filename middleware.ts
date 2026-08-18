import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refreshes the Supabase session on every request so Route Handlers always
 * see a valid token. Auth *decisions* live in lib/auth.ts, not here.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Touching getUser() refreshes an expired access token via the refresh token.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Skip static assets; run on pages and API routes.
    '/((?!_next/static|_next/image|favicon.ico|audio/|images/|fonts/).*)',
  ],
}
