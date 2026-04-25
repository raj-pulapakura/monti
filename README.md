# Monti

Turn any idea into an interactive experience. Describe a topic in plain language — Monti generates a self-contained, shareable interactive experience around it.

**[monti](https://monti.up.railway.app)** — hosted version, free to start.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | NestJS |
| Database / Auth | Supabase (PostgreSQL) |
| AI | OpenAI, Anthropic, Google |
| Billing | Stripe |
| Infra | Docker |

---

## Self-hosting

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- A [Supabase](https://supabase.com) project
- At least one AI provider API key (OpenAI, Anthropic, or Google)
- Node.js 20+ (for running Supabase migrations locally)

### 1. Clone the repo

```bash
git clone https://github.com/your-org/monti.git
cd monti
```

### 2. Configure environment variables

```bash
cp web/.env.example web/.env
cp backend/.env.example backend/.env
```

Fill in both files — see [Environment variables](#environment-variables) below.

### 3. Run database migrations

Install the Supabase CLI, then:

```bash
supabase db push
```

Or apply the files in `supabase/migrations/` manually against your Supabase project.

### 4. Start the app

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Web: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3001](http://localhost:3001)

---

## Environment variables

### `web/.env`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

### `backend/.env`

**Server**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the backend listens on |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

**AI providers** — at least one required

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google AI API key |

**Supabase**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_JWT_ISSUER` | JWT issuer (from Supabase project settings) |

**Billing (optional)** — all off by default

| Variable | Default | Description |
|---|---|---|
| `BILLING_ENABLED` | `false` | Master switch for billing |
| `CREDIT_ENFORCEMENT_ENABLED` | `false` | Deduct credits on generation |
| `STRIPE_WEBHOOKS_ENABLED` | `false` | Process incoming Stripe webhooks |
| `BILLING_PORTAL_ENABLED` | `false` | Enable Stripe Customer Portal |
| `FREE_CREDIT_GRANTS_ENABLED` | `false` | Grant free credits on signup |
| `TOPUPS_ENABLED` | `false` | Allow credit top-ups |
| `STRIPE_SECRET_KEY` | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PAID_MONTHLY` | — | Stripe price ID for paid plan |
| `STRIPE_PRICE_ID_TOPUP_300` | — | Stripe price ID for 300-credit top-up |
| `BILLING_PUBLIC_BASE_URL` | — | Public web origin for Stripe redirects |

---

## License

[AGPL-3.0](./LICENSE)
