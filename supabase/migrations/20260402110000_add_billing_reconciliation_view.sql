drop view if exists public.billing_reconciliation_summary;

create view public.billing_reconciliation_summary as
select
  date_trunc('month', cle.created_at)::date as month,
  coalesce(ev.quality_mode, gr.quality_mode, 'unknown')::text as quality_tier,
  sum(abs(cle.credits_delta))::int as credits_debited,
  sum(coalesce(gr.request_tokens_in, 0))::bigint as request_tokens_in,
  sum(coalesce(gr.request_tokens_out, 0))::bigint as request_tokens_out,
  sum(coalesce(gr.request_tokens_in, 0) + coalesce(gr.request_tokens_out, 0))::bigint as total_tokens,
  count(*)::int as rows_included
from public.credit_ledger_entries cle
left join public.experience_versions ev
  on ev.id = (cle.metadata ->> 'experience_version_id')::uuid
left join public.generation_runs gr
  on gr.version_id = ev.id
where cle.entry_type = 'debit_settled'
group by 1, 2
order by 1 desc, 2 asc;
