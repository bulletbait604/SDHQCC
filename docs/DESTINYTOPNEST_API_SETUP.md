# DestinyTopNest API Setup

DestinyTopNest uses the Bungie.net API for player profiles, activity history, PGCR verification, and loadouts.

## Official Bungie API reference

- **Interactive docs (all endpoints):** [https://bungie-net.github.io/](https://bungie-net.github.io/)
- **API root path:** `https://www.bungie.net/Platform`
- **OAuth wiki:** [https://github.com/Bungie-net/api/wiki/OAuth-Documentation](https://github.com/Bungie-net/api/wiki/OAuth-Documentation)
- **Register app / API key:** [https://www.bungie.net/en/Application](https://www.bungie.net/en/Application)

Every request needs header `X-API-Key: <your key>`. OAuth routes need `Authorization: Bearer <access_token>`.

### Endpoints we use today

| Purpose | Bungie path (under `/Platform`) | Our wrapper |
|---------|----------------------------------|-------------|
| OAuth authorize | `https://www.bungie.net/en/OAuth/Authorize` | `bungieOAuth.ts` |
| OAuth token / refresh | `/App/OAuth/token/` | `bungieOAuth.ts` |
| Linked memberships | `/User/GetMembershipsForCurrentUser/` | `bungieOAuth.ts` |
| Profile + characters | `/Destiny2/{type}/Profile/{id}/?components=…` | `bungieClient.ts` |
| Activity history | `/Destiny2/{type}/Account/{id}/Character/{charId}/Stats/Activities/` | `bungieClient.ts` |
| PGCR (run verification) | `/Destiny2/Stats/PostGameCarnageReport/{activityId}/` | `bungieClient.ts` |
| Manifest index | [https://www.bungie.net/Platform/Destiny2/Manifest/](https://www.bungie.net/Platform/Destiny2/Manifest/) | `getDestinyManifest()` |
| Single definition | `/Destiny2/Manifest/{EntityType}/{hash}/` | `resolveDefinition()` in `manifest.ts` |
| Armory search (by name) | `/Destiny2/Armory/Search/{EntityType}/{term}/` | `searchDestinyEntities()` |

Constants live in `src/lib/destiny/env.ts` (`BUNGIE_API_BASE`, `DESTINY_MANIFEST_URL`, OAuth URLs).

## Destiny 2 manifest (items, activities, perks)

Bungie publishes a **live manifest** that lists every Destiny definition table and version:

**https://www.bungie.net/Platform/Destiny2/Manifest/**

Each entity is fetched by type + hash, for example:

- Item: `/Destiny2/Manifest/DestinyInventoryItemDefinition/{itemHash}/`
- Activity: `/Destiny2/Manifest/DestinyActivityDefinition/{activityHash}/`
- Perk: `/Destiny2/Manifest/DestinySandboxPerkDefinition/{perkHash}/`

DestinyTopNest resolves hashes server-side via `src/lib/destiny/manifest.ts`:

| Function | Use |
|----------|-----|
| `resolveInventoryItem(hash)` | Weapon/armor name, icon, tier from PGCR or loadout |
| `resolveActivityByHash(hash)` | Raid/dungeon name from activity referenceId |
| `resolveDefinition(type, hash)` | Any manifest table |
| `getLiveManifestVersion()` | Current Bungie manifest version (patch indicator) |

Results are cached in Mongo `destiny_manifest_cache` for 7 days to limit API calls. Requires `DESTINY_API` on the server.

## Required (Phase 1+)

| Variable | Description |
|----------|-------------|
| `DESTINY_API` | Bungie API key from [Bungie Application](https://www.bungie.net/en/Application). Used server-side only via `/api/destiny/*` routes. |

Alias also supported: `BUNGIE_API_KEY`

## Bungie account linking (OAuth)

Users must be logged into SDHQCC (Kick) first, then connect Bungie from **Top Nest → Home**.

All logged-in users can access Top Nest data APIs. Admin review remains staff-only.

| Variable | Description |
|----------|-------------|
| `BUNGIE_OAUTH_CLIENT_ID` | OAuth client ID from Bungie application (Confidential client type) |
| `BUNGIE_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `DESTINY_API` | Same Bungie API key (required for token exchange) |

**Redirect URL** — set **both** on Vercel and in the Bungie developer portal (must match exactly):

```
BUNGIE_OAUTH_REDIRECT_URI=https://sdhqcc.vercel.app/api/destiny/auth/bungie/callback
NEXT_PUBLIC_BASE_URL=https://sdhqcc.vercel.app
```

In Bungie portal → your app → OAuth → Redirect URL, paste the same callback URL. No trailing slash. Must be `https://`.

The Profile panel shows the live redirect URL with a copy button — use that if unsure.

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

1. **Phase 1:** UI dashboard with mock data, Bungie client utilities, Mongo schemas
2. **Phase 2:** Bungie OAuth linking, live profile summary, token refresh
3. **Phase 3:** Run sync from Bungie PGCRs, heuristic legitimacy checker, admin review queue — **complete**
4. **Phase 4:** Build intelligence from verified runs (PGCR weapon extraction + aggregation) — **live**
5. **Phase 5:** Season prizes, fireteam reputation reviews, hall-of-fame standings — **in progress**

### Phase 5 — reputation & prizes

- **Rate fireteam:** Profile → Guardian → **Rate your fireteam** (linked Top Nest teammates only)
- `POST /api/destiny/reputation` — submit 1–5 scores after verified clears
- `GET /api/destiny/reputation?scope=reviewable` — pending teammate reviews
- **Season tab:** personal prize track, grouped hall of fame, prize rules
- `GET /api/destiny/season` — includes `prizeTrack`, `myStandings`, `hallOfFame`

### Phase 3 — sync runs

After linking Bungie on **Overview**, click **Sync verified runs** or call:

`POST /api/destiny/runs/sync` (requires login + linked Bungie account)

Flagged runs appear in **Admin Review** for manual approve/reject.

### Phase 4 — build intelligence

- PGCR weapon extraction on sync → `destiny_build_snapshots`
- Aggregated community cards on Home and Profile → Loadouts → Top builds

### External meta research (4-week window)

Curated meta builds are researched from:

- [Blueberries.gg](https://www.blueberries.gg/armor/best-destiny-2-builds/)
- [light.gg loadouts](https://www.light.gg/loadouts/db/)
- [togame.io PvE meta](https://togame.io/a/destiny2-pve-loadout-meta/)
- [builders.gg](https://builders.gg/destiny/dim-builds/)

Catalog lives in `src/lib/destiny/externalMetaResearch.ts` and syncs to Mongo on `/api/destiny/builds`. Profile → Loadouts → **Top builds** shows **Meta builds (last 4 weeks)** above verified PGCR data.

## Scoring rules

- Verified full completions only
- 2 points per clan member, 5 points per rando
- Raid: max 2 randos; Dungeon: max 1 rando
- Full Clan Team category: all members same clan
- Checkpoints: tracked, not scored unless admin approved
