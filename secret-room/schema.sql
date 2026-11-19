
create schema kanish_secret;
revoke all on schema kanish_secret from public, anon, authenticated;
create table kanish_secret.room (
  id boolean primary key default true check(id),
  questions jsonb,
  answers text,
  attempts integer not null default 0,
  attempt_window timestamptz not null default now()
);
insert into kanish_secret.room default values;
create table kanish_secret.sessions (token bytea primary key, expires timestamptz not null);
create table kanish_secret.messages (
  id uuid primary key,
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default clock_timestamp()
);
alter table kanish_secret.room enable row level security;
alter table kanish_secret.sessions enable row level security;
alter table kanish_secret.messages enable row level security;

create function public.kanish_secret_rpc(bridge text, action text, data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  room kanish_secret.room%rowtype;
  token_hash bytea;
begin
  if pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(bridge,''), 'UTF8')), 'hex') <> 'REPLACE_WITH_SHA256_OF_WORKER_BRIDGE_SECRET' then
    return '{"error":"Unavailable","status":403}';
  end if;

  if action = 'questions' then
    select * into room from kanish_secret.room;
    return jsonb_build_object('questions', room.questions);
  end if;

  if action in ('setup', 'unlock') then
    select * into room from kanish_secret.room for update;
    if action = 'setup' then
      if room.questions is not null then
        return '{"error":"Room already configured.","status":409}';
      end if;
      update kanish_secret.room set questions = data->'questions', answers = data->>'answers' where id = true;
    else
      if room.questions is null then
        return '{"error":"Room setup pending.","status":409}';
      end if;
      if room.attempt_window <= now() - interval '10 minutes' then
        update kanish_secret.room set attempts = 0, attempt_window = now() where id = true;
        room.attempts := 0;
      end if;
      if room.attempts >= 10 then
        return '{"error":"Too many attempts. Try again in 10 minutes.","status":429}';
      end if;
      if room.answers is distinct from (data->>'answers') then
        update kanish_secret.room set attempts = attempts + 1 where id = true;
        return '{"error":"One or more answers are incorrect.","status":401}';
      end if;
      update kanish_secret.room set attempts = 0, attempt_window = now() where id = true;
    end if;
    delete from kanish_secret.sessions where expires <= now();
    insert into kanish_secret.sessions values (
      sha256(convert_to(data->>'token','UTF8')), now() + interval '12 hours'
    );
    return '{"ok":true}';
  end if;

  token_hash := sha256(convert_to(data->>'token','UTF8'));
  if not exists (select 1 from kanish_secret.sessions where token = token_hash and expires > now()) then
    return '{"error":"Unlock the room first.","status":401}';
  end if;

  if action = 'lock' then
    delete from kanish_secret.sessions where token = token_hash;
    return '{"ok":true}';
  end if;

  if action = 'send' then
    insert into kanish_secret.messages(id,body) values ((data->>'id')::uuid,data->>'body')
      on conflict (id) do nothing;
    return '{"ok":true}';
  end if;

  if action = 'read' then
    return jsonb_build_object('messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at,m.id)
      from (
        select id,body,created_at from kanish_secret.messages
        where (created_at,id) < (coalesce((data->>'before')::timestamptz,'infinity'::timestamptz),
          coalesce((data->>'beforeId')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
        order by created_at desc,id desc limit 50
      ) m
    ),'[]'::jsonb));
  end if;
  return '{"error":"Unknown action.","status":400}';
end;
$$;
revoke all on function public.kanish_secret_rpc(text,text,jsonb) from public, authenticated;
grant execute on function public.kanish_secret_rpc(text,text,jsonb) to anon;
