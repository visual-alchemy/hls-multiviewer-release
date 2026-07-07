# AGENTS.md — HLS Multiviewer

## Current Branch: `feat/vidio`

## Session Summary (2026-07-07)

### Completed (pushed to origin/feat/vidio)

**Dependabot Automation (T4.4):**
- **Config File** (`.github/dependabot.yml`): Created Dependabot configuration file to schedule weekly dependency security updates for npm packages and Docker images.
- **Dependency Security Patches**: Patched 7 vulnerable packages (`next`, `picomatch`, `minimatch`, `lodash`, `glob`, `brace-expansion`) via `npm audit fix`, resolving 21/23 GitHub Dependabot alerts while keeping compatibility safe (building successfully and keeping all tests green).
- **Auto-Merge Workflows** (`.github/workflows/`): Created CI pipeline (`ci.yml`) and Dependabot auto-merge configuration (`dependabot-auto-merge.yml`) to automatically test, approve, and merge incoming dependency pull requests.



## Session Summary (2026-06-22)

### Completed (pushed to origin/feat/vidio)

**Persistent Daily Logs & Rotation (T2.1):**
- **Server API** (`app/api/logs/route.ts`): POST appends client-side stream transitions to date-named logs (`data/logs/{date}.log`) using the local Jakarta timezone. GET reads logs or triggers file attachment downloads.
- **Auto-Cleanup**: Automatically sweeps the logs directory on write to delete log files older than 7 days.
- **Log Viewer Dialog** (`components/log-viewer-dialog.tsx`): A terminal-styled modal featuring 4s live polling updates, a pulsing status indicator, auto-scroll to bottom, keyword color-coding, and export controls.
- **Custom Dialog Pass-Through** (`components/ui/dialog.tsx`): Fixed `DialogContent` to pass-through custom classes, implementing container height limitations (`max-h-[85vh]`) and scroll overlays.
- **Architecture Diagrams**: Added Mermaid sequence and topology diagrams to `README.md` mapping NGINX CORS proxy mechanics and multi-dashboard network flows.

## Session Summary (2026-06-16)

### Completed (pushed to origin/feat/vidio)

**Bug fix:** Per-panel 403 recovery (`video-player.tsx:553-561`)
- Recovery loop 403 handler now does `internalReloadCount++` instead of `isPermanentlyStoppedRef = true`
- Fixes players going permanently black after CDN token expiry

**Tier 1 reliability improvements:**

| Item | Files | Status |
|------|-------|--------|
| 1.1 Vidio API resolve | `lib/resolve.ts` (NEW), `video-player.tsx`, `app/api/resolve/route.ts` | Done |
| 1.3 Visual freeze detection | `hooks/use-frame-analyzer.ts` (NEW), `video-player.tsx` | Done |
| 1.4 Black frame detection | same hook — luminance path | Done |
| 1.5 Cross-stream error correlation | `multiviewer.tsx` | Done |

### Deleted: 1.2 Recovery State Machine

Removed from roadmap — stale-closure refs can't be eliminated by useReducer. 3.1 (component split) is the real fix.

### Alert Triggers (current state)

**Video Stalled** (5 triggers, all fire recovery loop):
1. Timecode stall — `currentTime` stuck 15s+
2. Silence + frozen — audio silent AND currentTime stuck
3. Fatal HLS error — 10s timer after any fatal error
4. Circuit breaker — 10+ consecutive non-fatals (502, network)
5. Canvas freeze — 3+ identical frames @ 64×36 / 2s intervals

**Video Black** (new, alert only, no recovery):
- Luminance < 2% for 10s continuous

**No Sound** (alert only, no recovery):
- RMS < threshold for 10s+ while video actively playing

**Per-panel hard reset** (full remount with fresh URL):
- HTTP 403 on main instance
- HTTP 403 on recovery instance
- `levelParsingError`

**Priority:** Video Stalled > Video Black > No Sound

### Roadmap

`ROADMAP.md` has checkbox trackers. [x] = done, [ ] = pending.
- T1 (Reliability): 4/4 done
- T2 (Observability): 1/1 done (Structured Logging complete)
- T3 (Architecture): 3/3 done (useAlarm, Stream types, and full Vitest suite complete)
- T4 (Nice-to-Have): 1/4 done (4.4 complete, 3 pending)

### Build & Deploy

```bash
# Local dev
npm run dev                     # port 3111

# Docker (on remote machine after git pull)
docker compose up -d --build

# Verify
npm run lint                    # 0 errors, 0 warnings
npm run build                   # 0 errors, 0 warnings
```

### Key Files

| File | Lines | Role |
|------|-------|------|
| `components/video-player.tsx` | ~670 | HLS lifecycle, recovery, alerts, UI |
| `components/multiviewer.tsx` | ~580 | Grid layout, stream CRUD, error correlation |
| `components/log-viewer-dialog.tsx` | ~110 | Terminal log console with live updates |
| `components/ui/dialog.tsx` | ~55 | Dialog modal container with scroll overlays |
| `app/api/logs/route.ts` | ~110 | Server-side daily log rotation & retention API |
| `hooks/use-frame-analyzer.ts` | ~193 | Canvas freeze/black detection |
| `lib/resolve.ts` | ~60 | Recursive .m3u8 URL search |
| `app/api/resolve/route.ts` | ~48 | Proxy to Vidio API |
| `lib/__tests__/logger-api.test.ts` | ~100 | Logging API unit test file |

### Known Quirks

- Vidio API resolve logs `"Could not find .m3u8"` for most streams — the recursive search is better than regex but the API response format may still not contain `.m3u8` URLs directly. Logs `describeJsonStructure()` on failure for debugging.
- External proxy at `192.168.40.54` hardcoded in `multiviewer.tsx:471` — change if proxy moves.
- Canvas frame analyzer is taint-safe — logs warning once if cross-origin blocks capture, then skips silently.
