-- Extend the existing admin application's tables without replacing its data.
alter table public.prompt_chains add column if not exists updated_at timestamptz not null default now();
alter table public.prompt_chains add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.prompt_chain_steps add column if not exists model text not null default 'gemini-2.5-flash';
alter table public.prompt_chain_steps add column if not exists temperature double precision not null default 0.8 check (temperature between 0 and 2);
update public.prompt_chain_steps s set model=regexp_replace(m.model_key,'^google/','') from public.llm_models m where s.model_id=m.id and m.model_key like 'google/gemini-%';
alter table public.prompt_chain_steps drop constraint prompt_chain_steps_chain_id_step_order_key;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_chain_id_step_order_key unique(chain_id,step_order) deferrable initially deferred;
create table public.prompt_chain_runs (
 id uuid primary key default gen_random_uuid(),chain_id uuid not null references public.prompt_chains(id) on delete cascade,
 created_by uuid not null references auth.users(id),input_text text not null default '',has_image boolean not null default false,
 status text not null check(status in ('running','complete','failed')),output_text text,error text,
 steps_snapshot jsonb not null default '[]',step_outputs jsonb not null default '[]',
 created_at timestamptz not null default now(),finished_at timestamptz
);
create index prompt_chain_runs_history on public.prompt_chain_runs(chain_id,created_at desc);
create unique index prompt_chain_one_active_run on public.prompt_chain_runs(created_by) where status='running';
alter table public.prompt_chain_runs enable row level security;
alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
grant select,insert,update,delete on public.prompt_chains,public.prompt_chain_steps,public.prompt_chain_runs to authenticated;
revoke all on public.prompt_chain_runs from anon;
create policy studio_chain_write on public.prompt_chains for all to authenticated using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
create policy studio_step_write on public.prompt_chain_steps for all to authenticated using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
create policy studio_runs on public.prompt_chain_runs for all to authenticated using ((select private.is_superadmin())) with check ((select private.is_superadmin()));

create function public.studio_add_step(p_chain uuid,p_step jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_count integer;v_order integer;
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 perform 1 from public.prompt_chains where id=p_chain for update;if not found then raise exception 'Chain not found';end if;
 select count(*),coalesce(max(step_order),0)+1 into v_count,v_order from public.prompt_chain_steps where chain_id=p_chain;
 if v_count>=20 then raise exception 'A chain can have at most 20 steps';end if;
 insert into public.prompt_chain_steps(chain_id,name,step_order,prompt_template,model,temperature) values(p_chain,p_step->>'name',v_order,p_step->>'prompt_template',p_step->>'model',(p_step->>'temperature')::double precision) returning id into v_id;
 update public.prompt_chains set updated_at=now() where id=p_chain;return v_id;
end;$$;
create function public.studio_reorder_steps(p_chain uuid,p_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 perform 1 from public.prompt_chains where id=p_chain for update;if not found then raise exception 'Chain not found';end if;
 select count(*) into v_count from public.prompt_chain_steps where chain_id=p_chain;
 if coalesce(cardinality(p_ids),0)<>v_count or (select count(distinct x) from unnest(p_ids) x)<>v_count or (select count(*) from public.prompt_chain_steps where chain_id=p_chain and id=any(p_ids))<>v_count then raise exception 'Steps changed. Refresh and try again.';end if;
 update public.prompt_chain_steps s set step_order=t.n from unnest(p_ids) with ordinality t(id,n) where s.id=t.id and s.chain_id=p_chain;
 update public.prompt_chains set updated_at=now() where id=p_chain;
end;$$;
create function public.studio_delete_step(p_chain uuid,p_step uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 perform 1 from public.prompt_chains where id=p_chain for update;if not found then raise exception 'Chain not found';end if;
 delete from public.prompt_chain_steps where chain_id=p_chain and id=p_step;if not found then raise exception 'Step not found';end if;
 update public.prompt_chain_steps s set step_order=t.n from (select id,row_number() over(order by step_order) n from public.prompt_chain_steps where chain_id=p_chain) t where s.id=t.id;
 update public.prompt_chains set updated_at=now() where id=p_chain;
end;$$;
create function public.studio_delete_chain(p_chain uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 perform 1 from public.prompt_chains where id=p_chain for update;if not found then raise exception 'Chain not found';end if;
 -- Keep existing mix references safe: fail the whole transaction if still in use.
 if exists(select 1 from public.prompt_chain_mix where chain_id=p_chain) then raise exception 'This chain is used in a prompt chain mix. Remove that mix entry in the admin app before deleting it.';end if;
 delete from public.prompt_chain_steps where chain_id=p_chain;
 delete from public.prompt_chains where id=p_chain;
end;$$;
create function public.studio_create_example() returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_superadmin() then raise exception 'Superadmin access required';end if;
 insert into public.prompt_chains(name,description,created_by) values('Image to captions '||substr(gen_random_uuid()::text,1,8),'An image, an unexpected observation, and five captions.',auth.uid()) returning id into v_id;
 perform public.studio_add_step(v_id,'{"name":"Describe the scene","prompt_template":"Describe the supplied image or scene clearly and specifically. Only describe what is visible or stated. Scene: {{input}}","model":"gemini-2.5-flash","temperature":0.4}');
 perform public.studio_add_step(v_id,'{"name":"Find the funny","prompt_template":"Find one playful, unexpected observation about this scene. Keep it kind and concise: {{previous}}","model":"gemini-2.5-flash","temperature":0.9}');
 perform public.studio_add_step(v_id,'{"name":"Write five captions","prompt_template":"Write five distinct, short, funny captions using this observation: {{previous}}. Return a numbered list with one caption per line.","model":"gemini-2.5-flash","temperature":0.9}');
 return v_id;
end;$$;
revoke all on function public.studio_add_step(uuid,jsonb),public.studio_reorder_steps(uuid,uuid[]),public.studio_delete_step(uuid,uuid),public.studio_delete_chain(uuid),public.studio_create_example() from public,anon;
grant execute on function public.studio_add_step(uuid,jsonb),public.studio_reorder_steps(uuid,uuid[]),public.studio_delete_step(uuid,uuid),public.studio_delete_chain(uuid),public.studio_create_example() to authenticated;
