import {requireAdmin} from '@/lib/auth';
import Studio from './studio';
export const dynamic='force-dynamic';
export default async function Home(){const {user}=await requireAdmin();return <Studio email={user.email||'Superadmin'} generationReady={!!process.env.GOOGLE_GENERATIVE_AI_API_KEY}/>}
