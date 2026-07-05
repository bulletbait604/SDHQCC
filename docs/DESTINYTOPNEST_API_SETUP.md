# DestinyTopNest API Setup

DestinyTopNest uses the Bungie.net API for player profiles, activity history, PGCR verification, and loadouts.

## Required (Phase 1+)

| Variable | Description |
|----------|-------------|
| `DESTINY_API` | Bungie API key from [Bungie Application](https://www.bungie.net/en/Application). Used server-side only via `/api/destiny/*` routes. |

Alias also supported: `BUNGIE_API_KEY`

## Bungie account linking (OAuth)

Users must be logged into SDHQCC (Kick) first, then connect Bungie from **DestinyTopNest → My Profile**.

| Variable | Description |
|----------|-------------|
| `BUNGIE_OAUTH_CLIENT_ID` | OAuth client ID from Bungie application (Confidential client type) |
| `BUNGIE_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `DESTINY_API` | Same Bungie API key (required for token exchange) |

**Redirect URL** (register in Bungie developer portal — must match exactly):

`https://sdhqcc.vercel.app/api/destiny/auth/bungie/callback`

The app derives the redirect URI from your live domain automatically. Override only if needed:

`BUNGIE_OAUTH_REDIRECT_URI=https://sdhqcc.vercel.app/api/destiny/auth/bungie/callback`

**Bungie app settings:** Client type must be **Confidential** (not Public) to receive refresh tokens.

### API routes

- `GET /api/destiny/auth/bungie/start` — begins OAuth (requires login)
- `GET /api/destiny/auth/bungie/callback` — Bungie redirect handler
- `GET /api/destiny/auth/bungie/status` — link status for current user
- `POST /api/destiny/auth/bungie/disconnect` — unlink account

Linked accounts are stored in `destiny_users` with encrypted-at-rest OAuth tokens (server-only, never sent to browser).

## Optional (legacy alias env names)

| Variable | Alias |
|----------|-------|
| `BUNGIE_CLIENT_ID` | `BUNGIE_OAUTH_CLIENT_ID` |
| `BUNGIE_CLIENT_SECRET` | `BUNGIE_OAUTH_CLIENT_SECRET` |

## MongoDB collections

DestinyTopNest uses the `sdhq` database:

- `destiny_users`
- `destiny_run_records`
- `destiny_leaderboard_entries`
- `destiny_fireteam_lobbies`
- `destiny_reputation_reviews`
- `destiny_build_snapshots`
- `destiny_seasons`
- `destiny_admin_reviews`
- `destiny_external_build_sources`
- `destiny_manifest_cache` — cached Bungie icon URLs (7-day TTL)

## Manifest icons

Gear, activity, subclass, and emblem thumbnails are resolved server-side via:

1. `itemsCatalog.ts` fallback hashes
2. Bungie `GetDestinyEntityDefinition` + Armory search
3. Mongo cache to avoid repeat manifest calls

Icon URLs use `https://www.bungie.net` + manifest `displayProperties.icon` paths.

## Weekly reset

Featured raid/dungeon rotation updates every **Tuesday 10:00 AM Pacific (17:00 UTC)**.
Schedule is maintained in `src/lib/destiny/weeklyRotation.ts` (Monument of Triumph era rotator).

## Phases

1. **Phase 1 (current):** UI dashboard with mock data, Bungie client utilities, Mongo schemas
2. **Phase 2 (in progress):** Bungie OAuth linking, live profile summary, token refresh
3. **Phase 3:** AI legitimacy checker, admin review queue
4. **Phase 4:** Build intelligence from verified runs
5. **Phase 5:** Prizes, reputation, optional Kick/Twitch/Discord

## Scoring rules

- Verified full completions only
- 2 points per clan member, 5 points per rando
- Raid: max 2 randos; Dungeon: max 1 rando
- Full Clan Team category: all members same clan
- Checkpoints: tracked, not scored unless admin approved
