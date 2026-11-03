import {createClient} from '@/lib/supabase/server';
import {id,text,stepInput} from '@/lib/validation';
export const dynamic='force-dynamic';
async function admin(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;const {data,error}=await db.from('profiles').select('is_superadmin').eq('id',user.id).single();return !error&&data?.is_superadmin===true&&user.app_metadata.provider==='google'?{db,user}:null;}
export async function GET(request:Request){const ctx=await admin();if(!ctx)return Response.json({error:'Superadmin access required.'},{status:403});const chain=new URL(request.url).searchParams.get('chain');
 if(!chain){const r=await ctx.db.from('prompt_chains').select('*').order('updated_at',{ascending:false});return r.error?Response.json({error:r.error.message},{status:500}):Response.json({chains:r.data});}
 try{id(chain)}catch{return Response.json({error:'Invalid chain.'},{status:400})}
 const [steps,runs]=await Promise.all([ctx.db.from('prompt_chain_steps').select('*').eq('chain_id',chain).order('step_order'),ctx.db.from('prompt_chain_runs').select('id,chain_id,input_text,status,output_text,error,step_outputs,created_at').eq('chain_id',chain).order('created_at',{ascending:false}).limit(50)]);
 if(steps.error||runs.error)return Response.json({error:steps.error?.message||runs.error?.message},{status:500});return Response.json({steps:steps.data,runs:runs.data});
}
export async function POST(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403});const ctx=await admin();if(!ctx)return Response.json({error:'Superadmin access required.'},{status:403});const {db,user}=ctx;
 try{const b=await request.json();let r;
 switch(b.action){
 case 'createChain':r=await db.from('prompt_chains').insert({name:text(b.name,'Chain name',100),description:typeof b.description==='string'?b.description.slice(0,1000):'',created_by:user.id}).select().single();break;
 case 'updateChain':r=await db.from('prompt_chains').update({name:text(b.name,'Chain name',100),description:typeof b.description==='string'?b.description.slice(0,1000):'',updated_at:new Date().toISOString()}).eq('id',id(b.id)).select().single();break;
 case 'deleteChain':r=await db.rpc('studio_delete_chain',{p_chain:id(b.id)});break;
 case 'createStep':r=await db.rpc('studio_add_step',{p_chain:id(b.chain_id),p_step:stepInput(b)});break;
 case 'updateStep':r=await db.from('prompt_chain_steps').update(stepInput(b)).eq('id',id(b.id)).eq('chain_id',id(b.chain_id)).select().single();break;
 case 'deleteStep':r=await db.rpc('studio_delete_step',{p_chain:id(b.chain_id),p_step:id(b.id)});break;
 case 'reorder':if(!Array.isArray(b.ids)||b.ids.length>20)throw new Error('Invalid step order.');r=await db.rpc('studio_reorder_steps',{p_chain:id(b.chain_id),p_ids:b.ids.map(id)});break;
 case 'template':r=await db.rpc('studio_create_example');break;
 default:throw new Error('Unknown action.');
 }
 if(r.error)throw new Error(r.error.message);return Response.json({data:r.data});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save.'},{status:400})}
}
