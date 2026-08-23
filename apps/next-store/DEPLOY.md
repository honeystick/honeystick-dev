# Deploying The Depot

The store runs as a Cloudflare Worker via [OpenNext](https://opennext.js.org/cloudflare).
Pushing to `main` deploys it; everything below is the one-time setup.

It runs on Vercel just as well, with no code change — see
[Deploying to Vercel instead](#deploying-to-vercel-instead).

## Why a Worker and not a static export

The shop floor is a server component that reads the catalogue with the secret
key, checkout and subscribe are server actions, and `/api/billing` is a route
handler. All three need a server at request time, so `next export` was never on
the table. OpenNext compiles Next's server half into a Worker and serves
`/public` plus the build output from Cloudflare's asset store.

## What is public and what is not

This repository is public. The split is deliberate rather than incidental:

| Lives in the repo | Lives outside it |
| --- | --- |
| `wrangler.jsonc` — worker name, route, compatibility flags | `HONEYSTICK_SECRET_KEY` — a Worker secret |
| `open-next.config.ts` | `CLOUDFLARE_API_TOKEN` — a GitHub Actions secret |
| `.env.example` — the template, with no values | `CLOUDFLARE_ACCOUNT_ID` — a GitHub Actions secret |
| `NEXT_PUBLIC_STORE_URL` in `vars` | `.env.local` — gitignored repo-wide |

Two things are worth stating plainly, because both are easy to get wrong once
and never notice:

- **`vars` in `wrangler.jsonc` is not a secret store.** Anything there is
  committed to a public repo *and* readable from the deployed Worker. Only
  values you would happily print belong in it.
- **`NEXT_PUBLIC_` means published.** Next inlines those into the client bundle
  at build time, so a secret with that prefix is served to every visitor. The
  same rule is why the Expo app's `EXPO_PUBLIC_` vars carry only an API URL.

## One-time setup

### 1. Cloudflare API token

Create a token at *My Profile → API Tokens* using the **Edit Cloudflare Workers**
template, scoped to the account and the `honeystick.co.za` zone. Nothing here
needs a Global API Key, and using one would hand CI the ability to do anything
your account can.

### 2. GitHub repository secrets

*Settings → Secrets and variables → Actions*:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow declares `environment: demo`. Create that environment and add a
required reviewer if you want a human between a merge and a deploy — with a
public repo and a token in play, that is cheap insurance.

### 3. The Honeystick key, set against the Worker

```sh
cd apps/next-store
npx wrangler secret put HONEYSTICK_SECRET_KEY              # demo
npx wrangler secret put HONEYSTICK_SECRET_KEY --env dev    # dev-demo
```

**Secrets are per environment**, so that is two commands and not one. Pointing
them at different organizations is the reason to have two Workers at all — a
test checkout on dev-demo then never appears in the demo organization's customer
list.

Set once, and it survives every subsequent deploy. That is why the CI job never
receives it: a leaked `CLOUDFLARE_API_TOKEN` costs you a redeploy, not an
organization's billing data.

**Use a sandbox key.** A public demo where anyone can reach checkout will create
real customers and real payment sessions in whichever organization the key
belongs to. A `sandbox` key points the SDK at `sandbox.api.honeystick.co.za` on
its own, with no extra configuration.

Leaving the secret unset is also a supported state, and is the safest way to run
the demo: the store falls back to the sample catalogue in
`lib/catalogue/plans.ts`, and both checkout and subscribe stop short of the one
call that needs an organization. A visitor still walks the whole flow.

### 4. DNS for both hostnames

Two Workers come out of this repo, from one build:

| Hostname | Worker | Deployed by |
| --- | --- | --- |
| `demo.honeystick.co.za` | `honeystick-demo` | `cf:deploy` |
| `dev-demo.honeystick.co.za` | `honeystick-demo-dev` | `cf:deploy:dev` |

Both are **Worker routes**, not custom domains, so each hostname needs a DNS
record that already exists and is **proxied** (orange cloud). The convention is
a placeholder the Worker never actually fetches from — an `AAAA` to a discard
address is what `demo` already uses. Copy it for `dev-demo`.

A route only intercepts a name that resolves into Cloudflare's network, so
without the record the deploy succeeds and the hostname serves nothing. That is
also why `custom_domain: true` is wrong here: it makes Cloudflare create and own
the record, which collides with one you already have.

## Deploying

Automatic on push to `main`, when anything under `apps/next-store/**` or
`packages/**` changes. `workflow_dispatch` runs it by hand.

Both Workers go out on every run, from a single build, dev first. They can share
a build because the only difference between them is `NEXT_PUBLIC_STORE_URL`,
which is read in `'use server'` files and therefore resolves from the Worker's
`vars` at request time rather than being inlined by `next build`. A value used
in a *client* component could not be shared this way and would need a build
each.

Dev is deployed first so that a deploy which is going to fail has already failed
before production is touched.

Locally:

```sh
npm run cf:build   --workspace @honeystick/next-store   # compile the Worker
npm run cf:preview --workspace @honeystick/next-store   # workerd, on localhost
npm run cf:deploy  --workspace @honeystick/next-store   # upload it
```

**`cf:build` first, always.** `preview` and `deploy` both act on a *built* app
and neither builds one — running `cf:deploy` on its own fails with "Could not
find compiled Open Next config", which reads like a configuration problem and is
really a missing step. The three scripts are one-to-one wrappers around the
OpenNext CLI rather than a chain, so this is the CLI's shape rather than ours.

`cf:preview` runs the real Worker runtime rather than `next dev`, which is the
only way to catch the class of bug where something works in Node and not in
workerd. Add `:dev` to either script to act on the dev Worker instead.

### Do not deploy from your laptop

Or if you do, know what you are shipping. OpenNext bakes whatever is in
`.env.local` into `.open-next/cloudflare/next-env.mjs`, which travels inside the
Worker bundle — so a local build puts your development secret key in the
deployed artifact. It does not take effect (bindings are applied first, and the
baked values are a `??=` fallback), but it is present and readable by anyone who
can download the Worker.

A CI build has no `.env.local`, so it bakes `export const production = {}` and
the Worker secret is the only source. That is the clean path, and it is the one
the workflow uses.

## Only this app deploys

`apps/expo-store` and `apps/express-api` have no Cloudflare project and are not
referenced by the workflow's `paths` filter. Nothing about them reaches
Cloudflare.

## Deploying to Vercel instead

The app runs on either host with no code change. Everything that used to make
this a real choice — the SSE stream — was made host-independent: `/api/events`
watches the plan the client named by asking Honeystick directly, so it behaves
the same in `next dev`, on Workers and on Vercel. See `lib/events/bus.ts`.

Vercel's advantage is that it runs Next natively rather than through the
OpenNext adapter, so there is no `cf:build` step and no workerd-vs-Node class of
bug. Cloudflare's is that you are already on it, and that Workers cap CPU time
rather than wall-clock, so a mostly-idle stream can stay open indefinitely
instead of being recycled every five minutes.

### Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `apps/next-store` |
| Framework preset | Next.js (auto-detected) |
| Install command | leave default — Vercel detects the npm workspace and installs from the repo root, which is what resolves `honeystick` and `@honeystick/*` to the local packages |
| Build command | leave default (`next build`) — **not** `cf:build` |

Two environment variables, both under Production:

- `HONEYSTICK_SECRET_KEY` — mark it **Sensitive** so it cannot be read back out
  of the dashboard. It is the same key, not a new one.
- `NEXT_PUBLIC_STORE_URL` — `https://demo.honeystick.co.za`. `NEXT_PUBLIC_`
  means published: it is inlined into the client bundle, which is fine for an
  address and never for a key.

Nothing else needs setting. The notify callback is derived from the request
headers (`x-forwarded-proto` + `host`), which Vercel sets correctly, so
Honeystick posts back to the right origin with no configuration.

### Pointing Cloudflare DNS at it

Add Vercel's record for `demo` in the `honeystick.co.za` zone — a `CNAME` to
`cname.vercel-dns.com`, or the `A` record Vercel shows you — and set it to **DNS
only** (grey cloud), not proxied.

That grey cloud matters more than usual here. Proxying puts a second CDN in
front of a streaming response, and the failure mode is not an error: the stream
connects, the browser shows it as open, and frames arrive in a batch minutes
late or not at all. The route already sends `Cache-Control: no-transform` and
`X-Accel-Buffering: no` to discourage exactly that, but the reliable answer is
not to double-proxy a stream at all.

Remove the `routes` block from `wrangler.jsonc` when you cut over, or Cloudflare
will keep the custom-domain record it manages and the two will fight over the
hostname.

### One thing to know about the licence

Vercel's [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
restrict Hobby to non-commercial personal use, and define commercial as any
deployment "used for the purpose of financial gain of anyone involved in any
part of the production of the project", listing "advertising the sale of a
product or service" as an example. A demo for a paid product is inside that
definition, so this belongs on Pro. Recorded here as a fact about the account
rather than a recommendation about the architecture.

## Known: the demo's in-memory data is per-isolate

`lib/demo/store.ts` holds stock and seats in module scope. On Workers that is
the lifetime of one isolate, so two visitors can see different shelves and a
cold start restores the defaults on its own. For a sample store that is fine —
the reset button exists precisely because this data is disposable — but it is
not somewhere to put anything that has to be true for everyone.
