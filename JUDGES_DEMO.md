# Judges Demo

This runbook shows how judges communicate with Parea and what to expect during the live demo.

Butterbase-hosted project page: [https://parea-wander.butterbase.dev](https://parea-wander.butterbase.dev)

## What Judges See

Parea is a chat-first group adventure agent. Judges type messages into a Spectrum chat provider. Parea replies in that same conversation with the current Wander, map link, and reroute.

Use the terminal provider for the most reliable local demo. Use Slack when Slack credentials are configured.

## Preflight

Install dependencies and run the quality gate:

```powershell
npm install
npm run check
```

Start or confirm the RocketRide local engine. If the VS Code RocketRide extension uses a dynamic port, copy that port into `ROCKETRIDE_URI`:

```powershell
$env:ROCKETRIDE_URI='http://localhost:61709'
```

For the full sponsor-backed path, these env vars should be set:

```text
VENUE_SOURCE=overpass
ROCKETRIDE_URI=http://localhost:61709
ROCKETRIDE_APIKEY=...
ROCKETRIDE_ADVENTURE_PIPELINE=pipelines/parea-adventure.pipe
ROCKETRIDE_OPENAI_KEY=...
XTRACE_API_KEY=...
XTRACE_ORG_ID=...
BUTTERBASE_APP_ID=...
BUTTERBASE_ANON_KEY=...
```

If Butterbase is not configured, the demo still runs with the in-memory store. If Slack is not configured, run the terminal provider.

## Automated Proof

Run the repeatable full-loop smoke before showing the live chat:

```powershell
$env:VENUE_SOURCE='overpass'
$env:ROCKETRIDE_URI='http://localhost:61709'
npm run full-loop:smoke
```

Expected result:

- One initial Presidio Wander delivery.
- One Chinatown reroute delivery.
- A successful JSON log entry for `full_loop_smoke`.

## Live Terminal Demo

Start the chat provider:

```powershell
$env:SPECTRUM_PROVIDER='terminal'
$env:VENUE_SOURCE='overpass'
$env:ROCKETRIDE_URI='http://localhost:61709'
npm run judges:demo
```

Type these messages exactly:

```text
I am in
we want something mellow
we moved to Chinatown
where are we?
```

Expected flow:

1. `I am in` adds the judge as a group member.
2. `we want something mellow` starts a mellow Presidio Wander.
3. Parea replies with a generated adventure and a map link.
4. `we moved to Chinatown` simulates a location update outside the active zone.
5. Parea writes the contradiction to XTrace, reads the revised belief, generates a Chinatown reroute, persists it, and replies with the new route.
6. `where are we?` confirms the active reroute adventure.

Slash commands are available as a fallback:

```text
/join
/vibe mellow
/move chinatown
/status
```

## Slack Demo

Set Slack as the Spectrum provider:

```powershell
$env:SPECTRUM_PROVIDER='slack'
$env:SLACK_TEAM_ID='...'
$env:SLACK_BOT_TOKEN='...'
$env:VENUE_SOURCE='overpass'
$env:ROCKETRIDE_URI='http://localhost:61709'
npm run judges:demo
```

In the Slack channel or DM, type the same messages:

```text
I am in
we want something mellow
we moved to Chinatown
where are we?
```

If using Spectrum Cloud instead of direct Slack credentials, set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` as well.

## Talking Script

Use this short narration while running the demo:

1. "Parea starts inside chat, so there is no separate app for the group to install."
2. "The group chooses a vibe, and Parea computes a privacy-safe group centroid without persisting raw member GPS."
3. "RocketRide generates the actual adventure from live venue candidates."
4. "XTrace stores and revises the belief about what the group wants."
5. "When the simulated group moves to Chinatown, deterministic zone logic detects that the current Wander no longer fits."
6. "Parea regenerates and persists a new route, then delivers it back to the same chat."

## Troubleshooting

- If the chat does not start, run `npm run judges:demo -- --help` to verify the command surface.
- If RocketRide fails to connect, check the port shown by the RocketRide extension and update `ROCKETRIDE_URI`.
- If Slack does not receive messages, fall back to the terminal provider and keep the same message script.
- If live venue lookup is slow, set `VENUE_SOURCE=stub` for a deterministic local fallback.
