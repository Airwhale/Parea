# Parea

Parea Wander is a TypeScript/Node hackathon demo for a group-adventure agent that starts in a messaging app, computes a privacy-safe group meeting point, generates an adventure from live venue data, and reroutes when the group leaves the current zone.

This repository is being built in small PRs. The current code runs a fully stubbed Wander loop; sponsor SDK integrations land in follow-up branches.

## Local Development

Prerequisites:

- Node.js 22 or newer
- npm 10 or newer

Setup:

```bash
npm install
cp .env.example .env
npm run check
npm run dev
```

Useful scripts:

- `npm run dev` starts the typed config loader and runs the canned Presidio-to-Chinatown loop. It uses configured XTrace memory and RocketRide adventure generation when credentials are set, and stubs otherwise.
- `npm run dev:terminal` starts the Spectrum terminal provider for manual chat testing.
- `npm run adventure:smoke` generates a live venue-backed Chinatown adventure through Overpass, and uses RocketRide composition when `ROCKETRIDE_APIKEY` and `ROCKETRIDE_ADVENTURE_PIPELINE` are set.
- `npm run xtrace:smoke` runs a live XTrace seed, contradiction, and read-back smoke when `XTRACE_API_KEY` and `XTRACE_ORG_ID` are set.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs Vitest.
- `npm run test:coverage` runs tests with coverage thresholds.
- `npm run check` runs lint, typecheck, and tests.

Manual Spectrum terminal smoke:

```bash
npm run dev:terminal
```

In the terminal chat, use `/start`, `/join`, `/vibe mellow`, `/move presidio`, `/move chinatown`, and `/status`. Plain text commands without the slash also work. A successful smoke produces the initial Presidio Stroll and then a Chinatown Snack Quest reroute after `/move chinatown`.

Manual adventure generation smoke:

```bash
npm run adventure:smoke
```

By default this smoke uses Overpass live venue data with the deterministic local composer. To run the RocketRide composer, set `ROCKETRIDE_APIKEY`, `ROCKETRIDE_OPENAI_KEY`, and `ROCKETRIDE_ADVENTURE_PIPELINE=pipelines/parea-adventure.pipe`.

## Branch Plan

Each implementation slice is built on its own branch, pushed to GitHub, and opened as a normal PR for manual review before the next slice starts.

1. `codex/01-bootstrap-hygiene`
2. `codex/02-core-stub-loop`
3. `codex/03-spectrum-terminal`
4. `codex/04-xtrace-spike`
5. `codex/05-rocketride-generation`
6. `codex/06-butterbase-store`
7. `codex/07-gps-demo-script`
8. `codex/08-readme-ci-polish`
