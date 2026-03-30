-- Persist normalized usage telemetry across generation, router, and conversation boundaries.

alter table public.generation_runs
  add column if not exists attempt_count int not null default 0 check (attempt_count >= 0),
  add column if not exists request_tokens_in int null,
  add column if not exists request_tokens_out int null;

alter table public.assistant_runs
  add column if not exists conversation_tokens_in int null,
  add column if not exists conversation_tokens_out int null;

alter table public.tool_invocations
  add column if not exists router_provider text null check (
    router_provider in ('openai', 'anthropic', 'gemini')
  ),
  add column if not exists router_model text null,
  add column if not exists router_request_raw jsonb null,
  add column if not exists router_response_raw jsonb null,
  add column if not exists router_tokens_in int null,
  add column if not exists router_tokens_out int null;

update public.generation_runs
set attempt_count = 1
where attempt_count = 0
  and status in ('running', 'succeeded', 'failed');
