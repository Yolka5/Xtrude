-- Xtrude: no default user.
--
-- migrate-users.sql gave every user_id column a DEFAULT of Yoni's uuid so
-- the pre-OAuth app kept working. With several accounts that default is a
-- silent misattribution: any insert that forgets user_id lands on Yoni.
-- The app always sends user_id now, so drop the defaults and let a missing
-- id fail loudly instead.
--
-- webhook_deliveries: attempts that cannot be tied to one of our
-- registrations (bad JSON, unknown webhookId, rate limited before lookup)
-- now log with user_id null instead of being filed under Yoni.
--
-- Also removes @ reservations that no account actually holds (the
-- reservation's owner has a different current @). A claim bug reserved
-- moochah2..moochah20 for one account that kept @moochah.
--
-- Safe with both the old and the new code (both always send user_id).
-- Idempotent: safe to re-run.

alter table tracked_documents     alter column user_id drop default;
alter table events                alter column user_id drop default;
alter table sessions              alter column user_id drop default;
alter table daily_stats           alter column user_id drop default;
alter table webhook_registrations alter column user_id drop default;
alter table webhook_deliveries    alter column user_id drop default;

alter table webhook_deliveries alter column user_id drop not null;

delete from app_state t
where t.key like 'handle\_taken\_%'
  and not exists (
    select 1
    from app_state u
    where u.key = 'handle_user_' || (t.value->>'userId')
      and u.value->>'handle' = substring(t.key from char_length('handle_taken_') + 1)
  );
