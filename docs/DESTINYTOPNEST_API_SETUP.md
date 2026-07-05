# DestinyTopNest API Setup

DestinyTopNest uses the Bungie.net API for player profiles, activity history, PGCR verification, and loadouts.

## Required (Phase 1+)

| Variable | Description |
|----------|-------------|
| `DESTINY_API` | Bungie API key from [Bungie Application](https://www.bungie.net/en/Application). Used server-side only via `/api/destiny/*` routes. |

Alias also supported: `BUNGIE_API_KEY`

## Optional (Phase 2 — Bungie OAuth)

| Variable | Description |
|----------|-------------|
| `BUNGIE_OAUTH_CLIENT_ID` | OAuth client ID from your Bungie application |
| `BUNGIE_OAUTH_CLIENT_SECRET` | OAuth client secret |

OAuth is required for:
- Linking a user's Bungie account to their SDHQ account
- Reading private profile/loadout data
- Equipping items where Bungie API allows

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

## Phases

1. **Phase 1 (current):** UI dashboard with mock data, Bungie client utilities, Mongo schemas
2. **Phase 2:** Bungie OAuth, real profiles, PGCR ingestion, scoring
3. **Phase 3:** AI legitimacy checker, admin review queue
4. **Phase 4:** Build intelligence from verified runs
5. **Phase 5:** Prizes, reputation, optional Kick/Twitch/Discord

## Scoring rules

- Verified full completions only
- 2 points per clan member, 5 points per rando
- Raid: max 2 randos; Dungeon: max 1 rando
- Full Clan Team category: all members same clan
- Checkpoints: tracked, not scored unless admin approved
