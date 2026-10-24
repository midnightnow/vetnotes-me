# VetNotes Deployment Guide

## Which repo and which site

- **This repo (`midnightnow/vetnotes-me`) is the only live VetNotes source.** It serves
  **vetnotes.me** (and, historically, vetnotes.pro).
- `vetnotes-pro`, `vetnotes-web`, `vetnotes-me-studio` and `Vetnotes-studio` are old scaffolds.
  Nothing live is built from them. Do not deploy from them.

| Site | Firebase project | How it is served |
|------|------------------|------------------|
| vetnotes.me | `vetnotes-mvp` (hosting target `ssr`) | Hosting rewrites `**` to Cloud Run **`vetnotes-cpd-ssr`** (australia-southeast1, adapter-node) |
| vetnotes.pro | `vetnotes-pro` (hosting target `production`) | A static build from 2026-07-01. `npm run deploy:pro` is disabled (see below). |

Auth users and all app data (CPD, Pro entitlements, notes sync) live in Firebase project
**`vetsorcery`**, not `vetnotes-mvp`. The Cloud Run service runs with
`GOOGLE_CLOUD_PROJECT=vetsorcery`.

---

## Deploy vetnotes.me (the app)

```bash
npm run deploy:ssr
```

That runs `predeploy:check` (`scripts/ops/require-clean-tree.sh`, refuses a dirty tree) and then
`gcloud run deploy vetnotes-cpd-ssr --source .`. The upload is whatever is on disk, filtered by
`.gcloudignore`, so **deploy only from a clean checkout of a commit that is on `origin/main`.**
The container (`Dockerfile`) runs `npm install` from `package.json` (not the lockfile) and
`node build-ssr/index.js`.

Only if `firebase.json`'s `ssr` rewrite changes:

```bash
npm run deploy:ssr-hosting
```

When editing the service's env, use `--update-env-vars`. Never use `--set-env-vars`, which wipes the rest.

## vetnotes.pro

`npm run deploy:pro` exits with an error on purpose. The app builds with adapter-node into
`build-ssr/`, so a static deploy of `build/` would publish a stale or empty site. The live
vetnotes.pro bundle predates the clinical-safety fixes. The intended fix is to redirect
vetnotes.pro to vetnotes.me. That is an owner action in the Firebase console or DNS.

---

## Runtime configuration (Cloud Run `vetnotes-cpd-ssr`)

| Variable | Kind | Used by |
|----------|------|---------|
| `GOOGLE_CLOUD_PROJECT` | env (`vetsorcery`) | Admin SDK project for auth + Firestore |
| `STRIPE_SECRET_KEY` | secret | Pro/CPD checkout; resolving refunds and disputes in the webhooks |
| `VETNOTES_PRO_PRICE_ID` | env | Pro checkout (A$49/mo) |
| `STRIPE_PRO_WEBHOOK_SECRET` | secret | `POST /api/pro/webhook` |
| `CPD_PRICE_ID`, `CPD_CHECKOUT_MODE` | env | CPD checkout (unset = checkout returns 503, CPD sales off) |
| `STRIPE_CPD_WEBHOOK_SECRET` | secret | `POST /api/cpd/webhook` |
| `VERTEX_PROJECT` | env, optional | Vertex project for cloud SOAP structuring (default `vetsorcery`) |
| `VETNOTES_SOAP_MODEL` | env, optional | Primary model (default `gemini-3.6-flash`, fallback `gemini-3.8-flash`) |

Build-time (committed `.env.production`, public by design): `VITE_FIREBASE_API_KEY`,
`VITE_GA_MEASUREMENT_ID`. No AI key is baked into the bundle.

### IAM for the service account

The service runs as `1071155694256-compute@developer.gserviceaccount.com`. On project `vetsorcery` it needs:

- `roles/datastore.user` for Firestore (granted).
- `roles/aiplatform.user` for cloud SOAP structuring (`/api/soap/structure`). Until this is granted,
  the route returns `503 { configured: false }` and the editor falls back to local keyword rules,
  saying so in its status line.

### Stripe webhook endpoints

Both endpoints need these events (`src/lib/server/stripe_webhook.ts`):

- `https://vetnotes.me/api/pro/webhook`
- `https://vetnotes.me/api/cpd/webhook`

Events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `charge.dispute.created`

The Stripe account is shared with other products. Every checkout this app creates stamps
`metadata.app_key=vetnotes`, so VetSorcery's webhook skips it. Do not remove that.

---

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest
npm run check    # svelte-check
```

Install from inside this repo's own folder. Under the VET monorepo, npm hoists into the root
workspace, and `npm ci` fails because the lockfile is out of sync with `package.json`. That is a
known issue, and the reason the Dockerfile uses `npm install`.
