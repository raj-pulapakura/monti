# Monti Backend

NestJS backend for Monti MVP.

## What This API Provides

- `POST /api/experiences/generate`: prompt -> structured interactive experience payload
- `POST /api/experiences/refine`: prior payload + refinement instruction -> regenerated payload
- `GET /`: health endpoint

## Rendering Contract (Important)

Generated output is intended for iframe rendering only.

- Render using sandboxed iframe: `sandbox="allow-scripts"`
- No direct host DOM injection
- No external network access from generated code
- No external script/library loading

The API includes this in `data.metadata.renderingContract` for client enforcement.

## Environment Variables

Copy and configure:

```bash
cp .env.example .env
```

Key variables:

- `PORT` (default `3001`)
- `OPENAI_API_KEY` (required for OpenAI)
- `ANTHROPIC_API_KEY` (required for Anthropic)
- `GOOGLE_API_KEY` (required for Gemini)
- `SUPABASE_URL` (required for persistence)
- `SUPABASE_SERVICE_ROLE_KEY` (required for persistence writes)

LLM provider/model/token/timeouts are code constants in `src/llm/llm-config.service.ts`, not environment-driven.

## Supabase Schema

Supabase SQL artifacts live at:

- `../supabase/migrations/20260315000100_create_experience_persistence.sql`
- `../supabase/schemas/experiences.sql`

Apply the migration in your Supabase project before running persistence flows.

If Supabase CLI is installed:

```bash
supabase db push
```

Without Supabase CLI, run the migration SQL in Supabase SQL Editor.

## Run

```bash
npm install
npm run start:dev
```

## Test

```bash
npm test
npm run test:e2e
```
