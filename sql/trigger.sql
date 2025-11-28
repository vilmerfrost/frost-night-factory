-- SQL trigger to auto-start task when message is sent
-- Run this in Supabase SQL Editor

create or replace function nf_autostart()
returns trigger as $$
begin
  update night_tasks
  set status = 'pending'
  where id = new.task_id;
  return new;
end;
$$ language plpgsql;

create trigger nf_msg_trigger
after insert on night_task_messages
for each row execute procedure nf_autostart();

-- Enable REPLICA IDENTITY FULL for Realtime to work correctly
-- Run these in Supabase SQL Editor

ALTER TABLE night_task_runs REPLICA IDENTITY FULL;

ALTER TABLE night_tasks REPLICA IDENTITY FULL;

