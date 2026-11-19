alter table kanish_secret.room add column profile text not null default 'kanish' check (profile in ('admin','kanish'));
alter table kanish_secret.room drop constraint room_pkey;
alter table kanish_secret.room add primary key (profile);
insert into kanish_secret.room(profile) values ('admin');
alter table kanish_secret.sessions add column profile text references kanish_secret.room(profile);
alter table kanish_secret.messages add column author text references kanish_secret.room(profile);
CREATE OR REPLACE FUNCTION public.kanish_secret_rpc(bridge text, action text, data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  room kanish_secret.room%rowtype;
  token_hash bytea;
  selected_profile text := data->>'profile';
  session_profile text;
begin
  if pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(bridge,''), 'UTF8')), 'hex') <> 'REPLACE_WITH_SHA256_OF_WORKER_BRIDGE_SECRET' then
    return '{"error":"Unavailable","status":403}';
  end if;

  if action in ('questions','answer_baseline','setup','unlock') then
    if selected_profile is null or selected_profile not in ('admin','kanish') then
      return '{"error":"Choose Admin or Kanish.","status":400}';
    end if;
  end if;

  if action = 'answer_baseline' then
    select * into room from kanish_secret.room where profile = selected_profile;
    return jsonb_build_object('baseline', room.answer_baseline);
  end if;

  if action = 'questions' then
    select * into room from kanish_secret.room where profile = selected_profile;
    return jsonb_build_object('questions', case when jsonb_array_length(room.questions) = 3 then room.questions end, 'upgrade', coalesce(jsonb_array_length(room.questions) = 2, false));
  end if;

  if action in ('setup', 'unlock') then
    select * into room from kanish_secret.room where profile = selected_profile for update;
    if action = 'setup' then
      if jsonb_array_length(room.questions) = 3 then
        return '{"error":"Room already configured.","status":409}';
      end if;
      if jsonb_typeof(data->'questions') is distinct from 'array' or jsonb_array_length(data->'questions') is distinct from 3 then
        return '{"error":"Enter three questions.","status":400}';
      end if;
      update kanish_secret.room set questions = data->'questions', answers = data->>'answers', answer_baseline = data->>'baseline', attempts = 0, attempt_window = now() where profile = selected_profile;
      delete from kanish_secret.sessions where profile = selected_profile;
    else
      if jsonb_array_length(room.questions) is distinct from 3 then
        return '{"error":"Room setup pending.","status":409}';
      end if;
      if room.attempt_window <= now() - interval '10 minutes' then
        update kanish_secret.room set attempts = 0, attempt_window = now() where profile = selected_profile;
        room.attempts := 0;
      end if;
      if room.attempts >= 10 then
        return '{"error":"Too many attempts. Try again in 10 minutes.","status":429}';
      end if;
      if room.answers is distinct from (data->>'answers') then
        update kanish_secret.room set attempts = attempts + 1 where profile = selected_profile;
        return '{"error":"One or more answers are incorrect.","status":401}';
      end if;
      update kanish_secret.room set attempts = 0, attempt_window = now(),
        answer_baseline = coalesce(answer_baseline, data->>'baseline') where profile = selected_profile;
    end if;
    delete from kanish_secret.sessions where expires <= now();
    insert into kanish_secret.sessions(token,expires,profile) values (
      sha256(convert_to(data->>'token','UTF8')), now() + interval '12 hours', selected_profile
    );
    return '{"ok":true}';
  end if;

  token_hash := sha256(convert_to(data->>'token','UTF8'));
  select session.profile into session_profile
  from kanish_secret.sessions as session
  join kanish_secret.room as account on account.profile = session.profile
  where session.token = token_hash and session.expires > now()
    and jsonb_array_length(account.questions) = 3;
  if session_profile is null then
    return '{"error":"Unlock the room first.","status":401}';
  end if;

  if action = 'lock' then
    delete from kanish_secret.sessions where token = token_hash;
    return '{"ok":true}';
  end if;

  if action = 'send' then
    insert into kanish_secret.messages(id,body,author) values ((data->>'id')::uuid,data->>'body',session_profile)
      on conflict (id) do nothing;
    return '{"ok":true}';
  end if;

  if action = 'read' then
    return jsonb_build_object('profile', session_profile, 'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at,m.id)
      from (
        select id,body,created_at,author from kanish_secret.messages
        where (created_at,id) < (coalesce((data->>'before')::timestamptz,'infinity'::timestamptz),
          coalesce((data->>'beforeId')::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
        order by created_at desc,id desc limit 50
      ) m
    ),'[]'::jsonb));
  end if;
  return '{"error":"Unknown action.","status":400}';
end;
$function$
;
