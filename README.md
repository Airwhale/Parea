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

- `npm run dev` starts the typed config loader and runs the canned Presidio-to-Chinatown stub loop.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test` runs Vitest.
- `npm run test:coverage` runs tests with coverage thresholds.
- `npm run check` runs lint, typecheck, and tests.

## Branch Plan

Each implementation slice is built on its own branch, pushed to GitHub, and opened as a normal PR for manual review before the next slice starts.

1. `codex/01-bootstrap-hygiene`
2. `codex/02-core-stub-loop`
3. `codex/03-spectrum-terminal`
4. `codex/04-xtrace-spike`
5. `codex/05-venues-rocketride`
6. `codex/06-butterbase-store`
7. `codex/07-gps-demo-script`
8. `codex/08-readme-ci-polish`
