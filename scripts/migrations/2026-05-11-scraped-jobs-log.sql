-- Dedup-Tabelle für Jobs, die wir von externen Quellen (Arbeitsagentur etc.) gescrapet
-- und in den `bewerbungen`-Pool übernommen haben.
--
-- Die `refnr` ist die offizielle Referenznummer aus der Bundesagentur-API
-- (z. B. "14792-IMR4L5LJWGS3OB21-S") und stellt sicher, dass dieselbe Stelle
-- nicht zweimal in den Pool wandert.
--
-- Ausführen im Supabase SQL Editor.

create table if not exists scraped_jobs_log (
  refnr         text primary key,
  source        text not null default 'arbeitsagentur',
  bewerbung_id  bigint,
  company_name  text,
  job_title     text,
  bereich       text,
  arbeitsort    text,
  had_email     boolean not null default false,
  had_phone     boolean not null default false,
  skipped_reason text,
  imported_at   timestamptz not null default now()
);

create index if not exists idx_scraped_jobs_log_imported_at
  on scraped_jobs_log (imported_at desc);

create index if not exists idx_scraped_jobs_log_bereich
  on scraped_jobs_log (bereich);

create index if not exists idx_scraped_jobs_log_source
  on scraped_jobs_log (source);

-- RLS: nur Service-Role darf schreiben (Cron / Admin-Endpoint).
-- Leseberechtigung für Admins über getrennte Policies bei Bedarf.
alter table scraped_jobs_log enable row level security;

drop policy if exists "scraped_jobs_log_admin_read" on scraped_jobs_log;
create policy "scraped_jobs_log_admin_read"
  on scraped_jobs_log
  for select
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
        and user_profiles.role = 'administrator'
    )
  );
