import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabase/config';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const db = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({name,value}) => request.cookies.set(name,value));
      response = NextResponse.next({request});
      values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
    }
  }});
  const {data:{user}} = await db.auth.getUser();
  const path = request.nextUrl.pathname;
  const publicRoute = path === '/login' || path === '/auth/callback';
  let destination = '';
  if (!publicRoute) {
    if (!user) destination = '/login';
    else if (user.app_metadata.provider !== 'google') destination = '/login?error=google';
    else {
      const {data,error} = await db.from('profiles').select('is_superadmin').eq('id',user.id).single();
      if (error || data?.is_superadmin !== true) destination = '/login?error=access';
    }
  }
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination,request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
