'use client';
import { createBrowserClient } from '@supabase/ssr';
// Only the public/anon key is passed from the server, never a service-role key.
export function createClient(url: string, key: string) {
  return createBrowserClient(url, key);
}
