# Contributing

Maintainer notes for this repo. If you are integrating the SDK into your own
app, [README.md](README.md) is the one you want.


## Running the sample stores

```sh
npm install

# the web store, self-contained
npm run dev -w @honeystick/next-store          # localhost:3000

# or the API plus any of its three clients
npm run dev -w @honeystick/express-api         # localhost:4000
npm run dev -w @honeystick/react-store         # localhost:5173
npm run start -w @honeystick/expo-store
npm run start -w @honeystick/rn-store
```

No keys needed. Without `HONEYSTICK_SECRET_KEY` every store serves a sample
catalogue and both checkout and subscribe walk the whole flow, stopping short of
the one call that needs an organization. Copy `.env.example` to `.env` (or
`.env.local`) and add a **sandbox** key to go live.

## How the packages are built

`dist` is gitignored, so it is built rather than committed. The root `prepare`
script runs `tsc --build` after `npm install`, which is the moment it has to
exist — a fresh clone about to run an app resolves `@honeystick/*` through npm
workspaces to `dist`, not to source.

The scoped packages carry `publishConfig.access: "public"`, without which npm
publishes a scoped package as restricted and installs fail for everyone else.
Releasing is a tag away — see [Shipping](#shipping).

## Status

Honest about what has been exercised, because the payment round trip reads like
a proven path and only half of it is.

**Verified against a running API:** the one-call checkout and email identity,
usage tracking including the 403 at a limit, `updateCard` on an unpaid plan,
`cancelPlan` and the `removed` case, and the native return bridge.

**Verified in isolation:** the receiving half of the notification. Given a plan
already at `latest_status: 'active'`, both stores' notify routes verify it by
re-reading and publish, and both streams deliver it. Those plans were put into
that state by hand and the posts were sent with `curl`.

**Not exercised:** everything upstream. No payment has been made at PayFast, no
ITN received, neither Inngest function run, and Honeystick has never actually
posted to a store's callback. The status mapping (`COMPLETE → active`) and the
callback body shape were checked by reading both sides, not by running them.

## Shipping

Two pipelines, in `.github/workflows`.

### Publishing the SDKs — `publish-packages.yml`

Triggered by a `v*` tag, never by a merge: publishing cannot be undone, so it
must not be something a pull request can cause by accident.

```sh
npm version 0.81.0 --workspaces --no-git-tag-version   # bump all seven together
git commit -am "packages: 0.81.0" && git tag v0.81.0
git push --follow-tags
```

`npm version --workspaces` bumps the apps too, which is harmless — they are
`private: true` and depend on the packages at `*`, so they follow the workspace
whatever its version. What it does *not* do is move the internal ranges in
`packages/*`, where `@honeystick/react` names `honeystick` at `^0.80.0`. Those
have to move with the version, or a published package resolves its sibling from
the registry at a range that does not exist yet and every install fails.

The job checks the tag matches every `package.json` version, builds, then
publishes in dependency order — `honeystick` first, because everything else
names it at a real semver range now. Any package whose version is already on the
registry is skipped, which is what makes a re-run after a partial failure safe
rather than a second attempt at the first package.

**No npm token.** Authentication is [trusted publishing](https://docs.npmjs.com/trusted-publishers):
the workflow mints an OIDC token that npm matches against a publisher configured
on each package, so there is nothing long-lived to store, leak or rotate. The
same token attaches `--provenance`, a signed statement of which repository,
workflow and commit built each tarball — verifiable with `npm audit signatures`.

A token is not an alternative, even as a shortcut. The `honeystick` org requires
2FA, and where an org requires 2FA and disallows tokens a granular token cannot
publish at all. npm is also withdrawing the capability: since 2026-07-31 a
2FA-bypass token can no longer change package access or trusted-publishing
config, and from January 2027 it loses direct publish entirely.

The one-time setup, already done for the seven packages that exist:

1. On npmjs.com, for **each** package: _Settings → Trusted Publisher → GitHub
   Actions_, naming this repository, `publish-packages.yml` and the `npm`
   environment. Until that exists the publish fails with a misleading 404.
2. A GitHub Environment called `npm` with a required reviewer. Publishing is the
   one action in this repo that cannot be undone.

**A brand-new package cannot be published by this workflow.** npm will not let a
trusted publisher be configured for a package that does not exist yet, so an
eighth package has to be created by one interactive `npm publish` from a
maintainer's terminal — at a throwaway version, under `--tag bootstrap` so
`latest` never points at a placeholder — before a trusted publisher can be
attached and the tag takes over. That is how the original seven were created at
`0.0.1-bootstrap.0`; those versions are deprecated and should not be unpublished,
since removing a package's only version deletes the package and its publisher
config with it.

`workflow_dispatch` takes a `dry-run` input, defaulting to true — it packs and
validates every package without uploading, which is the safe way to check a
release before cutting the tag.

### Deploying the demo — `deploy-demo.yml`

Triggered by a push to `main` touching `apps/next-store/**`, `packages/**` or the
lockfile. It builds once and deploys **two** Workers — `dev-demo` first, then
`demo` — as wrangler environments off the same bundle. They can share a build
because the only thing that differs is `NEXT_PUBLIC_STORE_URL`, which is read
server-side and so resolves from each Worker's `vars` at request time.

Each Worker holds its own `HONEYSTICK_SECRET_KEY`, set with
`wrangler secret put --env …`, so dev-demo can point at a scratch organization
and its test checkouts never reach the demo one.

`apps/next-store/DEPLOY.md` has the one-time setup — the API token, the DNS
records both hostnames need, and why a local build must not be deployed. It also
covers deploying to Vercel instead, which works with no code change.

Changes to `react-store`, `expo-store` or `rn-store` deploy nothing.
