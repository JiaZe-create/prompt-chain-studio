import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest) {
 const code=request.nextUrl.searchParams.get('code'); let destination='/login?error=callback';
 if(code) { const db=await createClient(); const {error}=await db.auth.exchangeCodeForSession(code); if(!error) destination='/'; }
 return new NextResponse(null,{status:303,headers:{Location:destination,'Cache-Control':'private, no-store'}});
}
