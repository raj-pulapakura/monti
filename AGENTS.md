## What Monti is

Monti is a chat-first studio for people who teach. You describe what learners should *get*; it turns that into small, hands-on experiences—poke it, see feedback, actually understand instead of passively reading.

**The gap:** most content is explain-then-quiz. Monti is for learn-by-doing in one tight, finishable interactive piece (not a deck with a quiz bolted on).

**Core flow:** talk in a thread → generate/refine the experience → repeat until it fits your learners. No code—the conversation is the work.

## Architecture (technical)

**Repos:** `web/` = Next.js (App Router), Supabase for auth/session; `backend/` = NestJS. The browser talks to Nest at `NEXT_PUBLIC_API_BASE_URL` (JWT from Supabase), not to Postgres directly for product APIs.

**Center of gravity — chat runtime** (`backend/src/chat-runtime/`): HTTP API under `/api/chat/threads/*` plus **SSE** (`…/events`) for run/tool/stream updates. `ConversationLoopService` drives multi-round **tool-capable** chat via `ToolLlmRouterService` and a small **tool registry** (right now the main tool path is **generate/refine experience**, implemented by `GenerateExperienceToolService`).

**Experience engine** (`backend/src/experience/`): `ExperienceOrchestratorService` turns prompts into versioned **HTML/CSS experience payloads** — prompt building, **LLM routing** (`LlmRouterService` / providers: OpenAI, Anthropic, Gemini), **validation + safety**, then persistence. Refines chain off the thread’s **sandbox** state (prior generation), not ad-hoc client payloads.

**Data & auth:** Supabase-backed repositories (`ChatRuntimeRepository`, experience persistence, play lookup). **Billing** (credits, Stripe, reservations) gates expensive tool work; **user profile** feeds optional system context.

**Public play:** `GET /api/play/:slug` serves published experiences by slug (separate from the authenticated studio).

**Web client:** `web/app/chat/[threadId]/` owns the thread UI — posts messages, subscribes to SSE, hydrates **sandbox preview** and version payloads; shared types/state in `web/app/runtime-state.ts`.

## Instructions for working with me

- don't suck up to me
- call me out when I'm wrong
- aggressively think about edge cases