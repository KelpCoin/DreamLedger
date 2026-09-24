alter table public.revenue_catalog add column if not exists currency text not null default 'NZD';
update public.revenue_catalog set currency='NZD' where currency is null;
