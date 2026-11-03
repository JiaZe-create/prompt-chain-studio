alter table public.prompt_chain_steps alter column model set default 'gemini-3.5-flash-lite';
create or replace function public.studio_create_example() returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 insert into public.prompt_chains(name,description,created_by) values('Image to captions '||substr(gen_random_uuid()::text,1,8),'An image, an unexpected observation, and five captions.',auth.uid()) returning id into v_id;
 perform public.studio_add_step(v_id,'{"name":"Describe the scene","prompt_template":"Describe the supplied image or scene clearly and specifically. Only describe what is visible or stated. Scene: {{input}}","model":"gemini-3.5-flash-lite","temperature":0.4}');
 perform public.studio_add_step(v_id,'{"name":"Find the funny","prompt_template":"Find one playful, unexpected observation about this scene. Keep it kind and concise: {{previous}}","model":"gemini-3.5-flash-lite","temperature":0.9}');
 perform public.studio_add_step(v_id,'{"name":"Write five captions","prompt_template":"Write five distinct, short, funny captions using this observation: {{previous}}. Return a numbered list with one caption per line.","model":"gemini-3.5-flash-lite","temperature":0.9}');
 return v_id;
end;$$;
