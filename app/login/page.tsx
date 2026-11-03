import LoginButton from './login-button';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { signOut } from '@/app/actions';
export const dynamic = 'force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const {error} = await searchParams; const {url,key} = getSupabaseConfig();
 return <main className="login"><div className="login-card"><p className="eyebrow">PROMPT CHAIN STUDIO</p><h1>Small steps.<br/>Great ideas.</h1><p>Sign in with your authorized Google account to build prompt chains, run experiments, and turn images into captions.</p>{error && <p role="alert" className="notice">{error==='access'?'Access is unavailable. Your account must have superadmin access, and the database must be reachable.':error==='google'?'Use your authorized Google account.':'Google sign-in could not finish. Please try again.'}</p>}<LoginButton url={url} apiKey={key}/>{error && <form action={signOut}><button className="secondary">Clear session and switch account</button></form>}<small>Google authentication · Superadmin access only</small></div></main>;
}
