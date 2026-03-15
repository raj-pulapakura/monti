-- Store raw provider request/response payloads per assistant run for debugging.

alter table public.assistant_runs
  add column if not exists provider_request_raw jsonb null,
  add column if not exists provider_response_raw jsonb null;
