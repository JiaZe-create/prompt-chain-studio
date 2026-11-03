import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
export async function requireAdmin() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  if (user.app_metadata.provider !== 'google') redirect('/login?error=google');
  const result = await db.from('profiles').select('id,is_superadmin').eq('id', user.id).single();
  if (result.error || result.data?.is_superadmin !== true) redirect('/login?error=access');
  return { db, user };
}
