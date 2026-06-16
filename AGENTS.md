# AGENTS.md — HLS Multiviewer

## Current Branch: `feat/vidio`

## Session Summary (2026-06-16)

### Completed (not pushed — waiting on local test)

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
| 1.2 Recovery state machine | — | Deferred (see below) |

### Deferred: 1.2 Recovery State Machine

Decision: skip as standalone item. The 7 refs (`hasFatalErrorRef`, `fatalErrorTypeRef`, `isPermanentlyStoppedRef`, etc.) exist for stale-closure bridging in timers/callbacks — a `useReducer` wouldn't eliminate them. Real maintainability win is 3.1 (component split into hooks). Recommend promoting 3.1 to Tier 1.

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
- T1: 4/5 done (1.2 deferred)
- T2-T4: all pending

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
| `components/multiviewer.tsx` | ~572 | Grid layout, stream CRUD, error correlation |
| `hooks/use-frame-analyzer.ts` | ~193 | Canvas freeze/black detection |
| `lib/resolve.ts` | ~60 | Recursive .m3u8 URL search |
| `app/api/resolve/route.ts` | ~48 | Proxy to Vidio API |

### Known Quirks

- Vidio API resolve logs `"Could not find .m3u8"` for most streams — the recursive search is better than regex but the API response format may still not contain `.m3u8` URLs directly. Logs `describeJsonStructure()` on failure for debugging.
- External proxy at `192.168.40.54` hardcoded in `multiviewer.tsx:471` — change if proxy moves.
- Canvas frame analyzer is taint-safe — logs warning once if cross-origin blocks capture, then skips silently.
