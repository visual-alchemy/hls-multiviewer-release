# HLS Multiviewer — Roadmap

## Tier 1: Reliability (fixes for active issues)

### [x] 1.1 Fix Vidio API URL Resolution
**Problem:** Every stream logs `"Could not find .m3u8 in API response"` on init. The regex-based approach (`jsonStr.match(/"([^"]+\.m3u8[^"]*)"/)`) searches raw JSON as a string and fails silently. Every stream falls back to a pre-configured proxy URL that carries already-expired CDN tokens.

**Fix:**
- Parse API response as proper JSON, traverse the object tree to find HLS URLs
- Support multiple URL formats the API may return (non-`https://` schemes, nested objects, URL arrays)
- Add `resolvedUrl` field to the Stream type so the dashboard doesn't re-resolve on every remount
- Log the actual API response shape on failure for debugging

### [x] 1.3 Video Freeze Detection (Visual)
**Problem:** Current stall detection only checks `video.currentTime` advancement. If timecode advances but frames are frozen (corrupted CDN segments, decoder stall, silent buffer corruption), no alert fires and the operator sees a frozen tile.

**Implementation:**
- Capture video frame into offscreen canvas every 2 seconds at low resolution (64×36)
- Compare consecutive sample hashes. If 3+ consecutive samples are identical AND `currentTime` is advancing → visual freeze alert
- Fires the same recovery path as a timecode stall (escalate to "Video Stalled", trigger recovery loop)

**Integration:** Same alert as existing "Video Stalled" — no new UI needed. Triggers same recovery mechanism.

### [x] 1.4 Video Black Frame Detection
**Problem:** A stream may be technically playing (currentTime advances, HLS segments loading fine) but the content is purely black — broadcast issue, source feed down, or encoder failure. Currently undetectable.

**Implementation:**
- Reuse the same canvas samples from freeze detection
- Compute average luminance per sample: `sum(R+G+B) / (3 * width * height)`
- If average luminance < threshold (e.g. 5/255) for 10+ consecutive seconds → "Video Black" alert
- Separate alert type from "Video Stalled" (different icon/color) since root cause differs
- 10s window avoids false positives during scene transitions or brief dark cuts

**False positive mitigation:**
- Skip detection during first 30s of stream startup (loading can show black briefly)
- Raise threshold during user solo/maximized view (operator is actively watching)
- Optional per-stream disable for known dark-content channels

### [x] 1.5 Cross-Stream Error Correlation
**Problem:** When 20+ streams all hit 502 simultaneously (proxy outage), the dashboard floods with identical error logs and each stream individually runs its recovery loop. The noise hides the signal.

**Fix:**
- `useRef` counter in the parent `MultiViewer` that tracks error counts across all streams in a rolling window
- When >50% of streams share the same error type (e.g. HTTP 502) within 30s → suppress per-stream error logging and show a single "Proxy unreachable" banner
- Recovery loops still run per-stream (they're independent) but the UI doesn't overwhelm the operator

---

## Tier 2: Observability (developer visibility)

### [x] 2.1 Structured Logging
**Problem:** All logs go to `console.log/warn/error` — unstructured, hard to filter in production.

**Implementation:**
- Create a lightweight structured logger: `{ stream, state, event, timestamp, data }`
- Log to console AND to a client-side ring buffer (last 10,000 events)
- Expose via `window.__multiviewer_logs` for remote debugging without browser console
- Add `/api/logs` endpoint for server-side aggregation, file rotation, and text downloads
- **Daily log rotation**: Server-side file writer saving daily log files (`data/logs/{date}.log`) mapped to host directories.
- **Auto-cleanup policy**: Automated 7-day log retention sweep that deletes log files older than 7 days.
- **In-app Log console**: A terminal-styled modal on the dashboard for real-time monitoring and downloading today's logs.

---

## Tier 3: Architecture (long-term health)

### [x] 3.1 VideoPlayer Component Split
**Problem:** `video-player.tsx` is 628 lines mixing video lifecycle, HLS configuration, alarm audio, recovery state machine, audio metering, and title bar UI. No single concern is testable in isolation.

**Split into:**
```
video-player.tsx        → UI shell (title bar, border, solo/fullscreen)
hooks/useHlsStream.ts   → HLS lifecycle, URL resolve, recovery state machine
hooks/useFrameAnalyzer.ts → canvas capture, freeze/black detection (Tier 1.3/1.4)
hooks/useAlarm.ts       → alert.mp3 playback, mute state, alert message
components/audio-visualizer.tsx → unchanged (already well-separated)
```

### [x] 3.2 Recovery Logic Tests
**Problem:** Zero tests. Every fix is deployed and verified manually on the production dashboard.

**Implementation:**
- Vitest for the recovery state machine (`useHlsStream.ts`) — no browser needed
- Test scenarios: 502 → circuit breaker → recovery → success, 403 → remount → fresh token, 5+ consecutive non-fatals → stream-down, levelParsingError → hard-reset, false "No Sound" during startup
- Vitest + jsdom for canvas-based detection (mock video element + canvas)
- Playwright smoke test: load dashboard with mock streams, verify grid renders

### [x] 3.3 Stream URL Management
**Problem:** Stream URLs are stored as raw proxy URLs in `streams.json`. No metadata about when the URL was last resolved, which CDN host it points to, or whether the token is still valid.

**Implementation:**
- Extend Stream type with `resolvedUrl`, `resolvedAt`, `cdnHost`, `tokenExpiry`
- Auto-re-resolve URLs approaching expiry (based on `hdntl=exp=` parameter in URL)
- Import/export preserves resolved metadata

---

## Tier 4: Nice-to-Have

### [ ] 4.1 Stream Grouping / Layout Presets
- Save named grid layouts (e.g. "FTA Prime", "Sports Event", "News Roundup")
- Load preset → rearranges streams and adjusts grid dimensions
- Useful for switching between monitoring contexts

### [ ] 4.2 CDN Health Dashboard
- Per-CDN-host latency monitoring (ping CDN edge via HEAD request to playlist)
- Color-code hosts on a mini map showing which CDN nodes are slow/down
- Helps identify regional CDN issues before streams start failing

### [ ] 4.3 Multi-Instance Manager
- Single page to view status across all 3 Docker instances (primary, event, konten)
- Instance health: CPU, memory, active streams, error rate
- Would need a small `/api/health` endpoint exposing stream counts + uptime
