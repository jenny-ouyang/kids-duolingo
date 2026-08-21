import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refreshes the Supabase session on every request so Route Handlers always
 * see a valid token. Auth *decisions* live in lib/auth.ts, not here.
 */
// Origins the Capacitor shell serves the UI from. Auth rides headers (not
// cookies) for these, so no Access-Control-Allow-Credentials is needed.
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'http://localhost', 'https://localhost'])

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-child-id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const isNativeApi = request.nextUrl.pathname.startsWith('/api/') && origin && NATIVE_ORIGINS.has(origin)

  if (isNativeApi && request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }

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

  if (isNativeApi) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) response.headers.set(k, v)
  }

  return response
}

export const config = {
  matcher: [
    // Skip static assets; run on pages and API routes.
    '/((?!_next/static|_next/image|favicon.ico|audio/|images/|fonts/).*)',
  ],
}
