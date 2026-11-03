import {createClient} from '@/lib/supabase/server';
import {id,renderPrompt} from '@/lib/validation';
import type {Step} from '@/lib/types';
export const maxDuration=300;
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return Response.json({error:'Sign in first.'},{status:401});
 const {data:profile}=await db.from('profiles').select('is_superadmin').eq('id',user.id).single();if(profile?.is_superadmin!==true||user.app_metadata.provider!=='google')return Response.json({error:'Superadmin access required.'},{status:403});
 const key=process.env.GOOGLE_GENERATIVE_AI_API_KEY;if(!key)return Response.json({error:'Generation is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY to this Vercel project and redeploy.'},{status:503});
 let runId:string|undefined;const outputs:{name:string;output:string;model:string}[]=[];
 try{
 const raw=await request.text();if(raw.length>3000000)throw new Error('Input is too large. Use an image under 2 MB.');const b=JSON.parse(raw);const chainId=id(b.chain_id);
 const input=typeof b.input==='string'?b.input.trim():'';if(input.length>12000)throw new Error('Text input is limited to 12,000 characters.');
 let image: {inlineData:{mimeType:string;data:string}}|undefined;
 if(b.image){if(typeof b.image!=='string')throw new Error('Invalid image.');const match=b.image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match||match[2].length>2800000)throw new Error('Choose a JPEG, PNG, or WebP under 2 MB.');image={inlineData:{mimeType:match[1],data:match[2]}};}
 if(!input&&!image)throw new Error('Add text or an image to run the chain.');
 const {data:steps,error}=await db.from('prompt_chain_steps').select('*').eq('chain_id',chainId).order('step_order');if(error)throw new Error(error.message);if(!steps?.length)throw new Error('Add at least one step first.');if(steps.length>20)throw new Error('A chain can have at most 20 steps.');
 // Expire abandoned runs before acquiring the per-user database lock.
 await db.from('prompt_chain_runs').update({status:'failed',error:'Run timed out. Please try again.'}).eq('created_by',user.id).eq('status','running').lt('created_at',new Date(Date.now()-6*60*1000).toISOString());
 const {data:run,error:insertError}=await db.from('prompt_chain_runs').insert({chain_id:chainId,created_by:user.id,input_text:input,has_image:!!image,status:'running',steps_snapshot:steps}).select('id').single();
 if(insertError)throw new Error(insertError.code==='23505'?'You already have a run in progress. Wait for it to finish.':insertError.message);runId=run.id;
 let previous=input;const deadline=Date.now()+240000;
 for(const step of steps as Step[]){
 const remaining=deadline-Date.now();if(remaining<1000)throw new Error('The chain exceeded the time limit. Try fewer steps.');
 const parts:unknown[]=[{text:renderPrompt(step.prompt_template,input,previous)}];if(image&&outputs.length===0)parts.push(image);
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(step.model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{temperature:step.temperature,maxOutputTokens:4096,...(step.model==='gemini-3.8-flash'?{thinkingConfig:{thinkingLevel:'low'}}:{})}}),signal:AbortSignal.timeout(Math.min(60000,remaining))});
 if(!response.ok){const reason=response.status===429?'Provider quota or rate limit reached.':response.status===400||response.status===401||response.status===403?'Check the provider API key and model access.':response.status===404?'This model is unavailable. Edit the step to use an available model.':'The provider is temporarily unavailable.';throw new Error(`Step ${outputs.length+1} (HTTP ${response.status}): ${reason}`);}
 const result=await response.json();previous=(result.candidates?.[0]?.content?.parts??[]).filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text||'').join('\n').trim();if(!previous)throw new Error(`Step ${outputs.length+1} returned no text. The provider may have blocked this input.`);
 outputs.push({name:step.name,output:previous,model:step.model});const save=await db.from('prompt_chain_runs').update({step_outputs:outputs}).eq('id',runId);if(save.error)throw new Error('Could not save step output.');
 }
 const saved=await db.from('prompt_chain_runs').update({status:'complete',output_text:previous,step_outputs:outputs,finished_at:new Date().toISOString()}).eq('id',runId);if(saved.error)throw new Error('Could not save the completed output.');return Response.json({id:runId,output:previous});
 }catch(e){const message=e instanceof Error?(e.name==='TimeoutError'?'The provider timed out. Try the run again.':e.message):'Generation failed.';if(runId)await db.from('prompt_chain_runs').update({status:'failed',error:message,step_outputs:outputs,finished_at:new Date().toISOString()}).eq('id',runId);return Response.json({error:message,id:runId},{status:400});}
}
