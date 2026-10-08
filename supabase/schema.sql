-- Plan: telefon ↔ web senkronu için tek tablo.
-- Supabase → SQL Editor → bu dosyanın tamamını yapıştır → Run.
-- Tekrar çalıştırmak güvenli: daha önce kurduysan yeni sürümü de böyle uygula.

create table if not exists public.documents (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_ms bigint not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Eski kurulumlar için.
alter table public.documents add column if not exists synced_at timestamptz not null default now();

alter table public.documents enable row level security;

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop index if exists documents_updated;
create index if not exists documents_synced on public.documents (user_id, synced_at);

-- Son yazan kazanır, ama eski bir kopya asla daha yenisinin üzerine yazılamaz.
-- Her yazıma sunucu saati (synced_at) basılır; cihazlar değişiklikleri buna göre çeker.
create or replace function public.documents_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_ms < old.updated_ms then
    return null; -- daha yeni olanı koru
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists documents_guard on public.documents;
create trigger documents_guard
  before insert or update on public.documents
  for each row execute function public.documents_guard();

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
