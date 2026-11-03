'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function LoginButton({ url, apiKey }: { url: string; apiKey: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true); setError('');
    try {
      const supabase = createClient(url, apiKey);
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch { setError('Google sign-in is unavailable. Please try again shortly.'); setBusy(false); }
  }
  return <><button className="button" onClick={login} disabled={busy}>{busy ? 'Connecting…' : 'Continue with Google'}</button>{error && <p role="alert" className="mt-4 text-red-600">{error}</p>}</>;
}
