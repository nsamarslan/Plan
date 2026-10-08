-- Plan: telefon ↔ web senkronu için tek tablo.
-- Supabase → SQL Editor → bu dosyanın tamamını yapıştır → Run.

create table if not exists public.documents (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_ms bigint not null,
  primary key (user_id, key)
);

alter table public.documents enable row level security;

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists documents_updated on public.documents (user_id, updated_ms);

-- Canlı güncelleme (telefonda yaptığın değişiklik web'de anında görünsün).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;
