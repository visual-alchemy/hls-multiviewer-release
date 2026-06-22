# Changelog

All notable changes to the HLS Multiviewer project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Vidio API URL resolution rewrite** (`lib/resolve.ts`): replaced regex-based `.m3u8` search with recursive JSON traversal (`findM3u8Urls()`). Handles nested objects, arrays, and multiple URL formats. On failure, logs the API response structure via `describeJsonStructure()` for debugging format changes.
- **Visual freeze detection** (`hooks/use-frame-analyzer.ts`): canvas-based frame capture at 64×36 resolution every 2s. Compares consecutive frames — if 3+ samples are identical while video timecode advances, triggers "Video Stalled" alert. Catches decoder stalls and corrupted segments that current timecode-based stall detection misses.
- **Video black frame detection**: reuses the same canvas pipeline. Computes average luminance per frame. If luminance stays below threshold (0.02/255) for 10+ continuous seconds, triggers "Video Black" alert. Clears automatically when luminance restores. Catches broadcast blackouts and source feed failures while the stream is technically still playing.
- **Cross-stream error correlation**: `onStreamStatus` prop reports per-stream HTTP errors to the parent MultiViewer. When >50% of active streams share the same error type (e.g. HTTP 502) within a 30s rolling window, a yellow banner appears at the top of the grid (e.g. "Proxy unreachable (502)"). Per-stream recovery loops still run independently — the banner suppresses noise, not recovery.
- **Better diagnostics on Vidio API resolve endpoint** (`/api/resolve`): logs HTTP status codes and top-level response keys to help debug `.m3u8` extraction failures at the server level.
- **Persistent server-side daily logging API** (`app/api/logs/route.ts`): records client-side stream transitions, warnings, and recovery actions to date-named files (`DD-MM-YYYY.log`) inside the volume-mounted `data/logs` folder. Formatted with local Jakarta (GMT+7) timestamps.
- **Self-cleaning log retention**: scans the log directory and automatically deletes log files older than 7 days whenever a new log entry is posted.
- **In-app Log Viewer modal** (`components/log-viewer-dialog.tsx`): terminal-style dashboard console displaying today's system logs with color-coded alerts (errors in red, warnings/stalls in amber, playing in green). Includes a pulsing "Live Feed" status indicator, 4-second polling updates, auto-scroll to bottom, and direct log file export.

### Fixed
- **Per-panel 403 recovery**: when a stream token expires during the recovery loop, the panel now performs an internal hard-reset (bumping `internalReloadCount`) instead of permanently stopping with `isPermanentlyStoppedRef = true`. This prevents players from going permanently black after a 403 token expiry — they now remount with a fresh URL resolve and cache-busted proxy URL, identical to what a manual browser refresh does.
- **Custom Dialog pass-through & scroll fix** (`components/ui/dialog.tsx`): updated the DialogContent component to support `className` overrides and enforce a maximum height of `85vh` with internal scrolling to prevent viewport overflows.

### Added (T2 — Structured Logging)
- **Structured logger** (`lib/logger.ts`): ring buffer logging with `{ stream, state, event, timestamp, data }` format. All 15 key state transitions (play_recovered, timecode_stall, http_403, visual_freeze, black_detect, recover_attempt, etc.) now emit structured entries alongside existing console output.
- **`window.__multiviewer_logs()`**: exposed globally — returns the last 10,000 structured log entries as an array for inspection, filtering, and copy-paste without needing the browser console open.
- **`getLogsByStream(stream)`**: filter the ring buffer to a specific stream for targeted debugging.

### Changed (T3 — Architecture Cleanup)
- **`useAlarm` hook extracted** (`hooks/use-alarm.ts`): alarm audio playback, mute state, and mute toggle moved out of `video-player.tsx` into a standalone hook. `video-player.tsx` dropped ~15 lines of alarm code.
- **Stream type extended** (`components/multiviewer.tsx`): added optional `resolvedUrl`, `resolvedAt`, and `cdnHost` fields for future URL metadata tracking. Backward-compatible — existing `streams.json` files work unchanged.
- **Vitest test suite** (`lib/__tests__/`): 10 tests across 2 files covering `findM3u8Urls`, `describeJsonStructure`, `streamLog`, `getLogs`, `getLogsByStream`, and ring buffer capacity. Run with `npm test`.



---

## [2.1.1] - 2026-04-07

### Fixed
- **Muting Alarm skips global soft-reloads**: clicking the bell icon to mute a stream now explicitly opts that stream out from triggering the 30-second global dashboard refresh sweep. Muted streams will quietly continue to try and recover internally without interrupting other playing streams on the dashboard.
- **Soft Reload triggered for all stalled streams**: previously, the dashboard-wide soft reload (F5 equivalent mechanism) only triggered if the stream received an explicit HTTP `403 Forbidden` error. It now triggers correctly if *any* error (like `404 Not Found` or `net::ERR_CONTENT_LENGTH_MISMATCH`) fails to self-recover after 30 seconds (6 attempts).
- **React timer cleanup bug**: fixed a severe bug where the 10-second soft-reload countdown was instantly cancelled the moment it was created. This occurred because triggering the "Reloading sweeps in 10s..." status updated a React state component, forcing a re-render which prematurely triggered the previous `useEffect`'s `clearTimeout` function. The 10-second timer has been moved to an isolated `useRef` to safely detach it from the render lifecycle.

---

## [2.1.0] - 2026-04-04

### Fixed
- **HLS recovery now fully recreates the instance**: instead of reusing a potentially corrupted HLS.js instance, the recovery loop now destroys it completely and creates a brand-new one — mirroring what a browser refresh does. Fixes streams that were stuck in "Video Stalled" and never self-healed without a manual page refresh.
- **`handleStall` log spam**: added an early guard (`if (hasFatalErrorRef.current) return`) that prevents the `stalled`/`waiting` video events from logging "Video stalled for 15+ seconds" repeatedly after the alert has already fired.
- **403 mid-recovery handled correctly**: the new HLS instance created during recovery now has its own 403 guard — if a stream token expires mid-recovery attempt, it stops permanently and clears the retry interval immediately.
- **Recovery loop escapes stopped state**: added an `isPermanentlyStoppedRef` check inside the retry `setInterval` so if the 403 flag is set asynchronously during a recovery cycle, the next tick bails out without attempting another reinit.

### Removed
- **"Stream Offline" alarm**: consolidated into "Video Stalled". HTTP 403 (expired token / stream taken offline) now shows "Video Stalled" instead of a separate alarm label — simplifies the alarm system without losing detection capability.

---

## [2.0.0] - 2026-04-01

### Added
- **Multi-instance Docker deployment**: isolated instances (`primary-1` port 3111, `event-1` port 3115, `konten-1` port 3116) each with dedicated Docker volumes
- **403 token expiry detection**: HTTP 403 responses stop all retries immediately — no retry spam on a dead/expired token. Shows "Video Stalled" to indicate the stream is down
- **Import confirmation dialog**: before replacing streams, shows an `AlertDialog` with the count of current vs imported streams. User must confirm before any data is overwritten
- **Toast notifications**: success and error feedback after import operations using shadcn/ui Toaster
- **Docker log rotation**: `json-file` driver with `max-size: 10m` and `max-file: 3` per container to prevent unbounded log growth

### Fixed
- **Import replaces instead of appending**: `POST /api/streams/import` now overwrites the current stream list entirely instead of merging
- **Stale closure in `handleStall`**: added `hasFatalErrorRef` to mirror `hasFatalError` state, preventing double-trigger of alerts after recovery
- **Recovery loop not stopping on resume**: added `retryIntervalRef` so `handlePlaying` immediately clears the 5s retry interval the moment the stream comes back — no more extra retry fires after recovery
- **Audio visualizer silenced in background tabs**: silence detection moved from `requestAnimationFrame` (throttled to ~1fps in hidden tabs) to `setInterval(100ms)` — alarm now fires correctly even when the tab is not in focus
- **Re-importing same file**: reset `input.value` after file selection so the same JSON file can be imported again without re-opening the picker

### Changed
- **HLS.js config**: enabled `enableWorker: true`, `liveDurationInfinity: true`, increased retry limits (`fragLoadingMaxRetry: 10`, `manifestLoadingMaxRetry: 10`), added `backBufferLength: 120`
- **Error threshold for stall alarm**: raised from 3 to 10 consecutive non-fatal errors before triggering "Video Stalled"
- **`bufferStalledError` excluded** from consecutive error counter (self-healing, too frequent)
- **Quality switching**: removed forced `hls.currentLevel = 0` on `MANIFEST_PARSED` (caused excessive re-buffering); quality now only switches when toggling Solo mode
- **Audio `.play()` errors**: wrapped in silent `.catch()` to suppress `AbortError` console spam
- **NGINX proxy**: each dashboard instance runs OpenResty with dynamic `UPSTREAM_HOST` injection to route traffic to the correct Next.js container

---

## [1.6.0] - 2025-12-31

### Fixed
- Stream recovery now properly handles both network and media errors
- Immediate recovery attempts when fatal errors occur (startLoad for network, recoverMediaError for media)
- Video playback now automatically resumes after recovery attempts
- Fixed stale URL reference in recovery logic

### Changed
- Improved error logging with recovery attempt counter
- Updated README.md with correct repository URLs, port numbers, and features

---

## [1.5.0] - 2025-12-18

### Changed
- Improved audio visualizer proportions - taller bars that fill more of the player frame
- Reduced L/R label size (capped at 8px font, 14px area) for better visual balance

---

## [1.4.0] - 2025-12-08

### Added
- Stereo segmented audio meter with L/R channel visualization
- Unified outline for audio meters

### Changed
- Audio meter width is now fixed while scaling vertically with player size

---

## [1.3.0] - 2025-12-01

### Changed
- Relaxed HLS buffering and retry settings for improved stream stability

---

## [1.2.0] - 2025-11-25

### Added
- Improved video recovery mechanism for failed streams

### Changed
- Updated alert audio file

### Removed
- Removed alert backup functionality

---

## [1.1.0] - 2025-11-19

### Added
- Global and per-tile playback controls (play/pause)
- Alert overlay displayed within video container
- Adjusted alert thresholds and overlay styling

### Changed
- Renamed package to `hls-multiviewer`

---

## [1.0.0] - 2025-11-15

### Added
- Audio silence alerting with visual and audible notifications

### Changed
- Improved global mute behavior - visualizers remain active when muted

---

## [0.9.0] - 2025-11-13

### Added
- Stream health alerting with blinking borders for fatal playback errors

### Changed
- Refactored useEffect initialization to avoid excessive memory usage

---

## [0.8.0] - 2025-09-17

### Added
- Docker support with Dockerfile and Caddyfile

### Changed
- Updated default port from 3000 to 3111

---

## [0.7.0] - 2025-02-17

### Changed
- Updated audio bar visualization

---

## [0.6.0] - 2025-02-16

### Added
- Grid editor for configurable rows and columns layout

---

## [0.5.0] - 2025-02-14

### Added
- Import and Export functionality for stream configurations (JSON)
- Logo and application title

---

## [0.4.0] - 2025-02-13

### Added
- Additional file uploads and documentation improvements

---

## [0.3.0] - 2025-02-04

### Added
- Initial multiviewer component with grid layout
- Video player component with HLS.js integration
- Real-time audio visualization for each stream
- Add, edit, and delete stream functionality
- Global mute/unmute controls
- Fullscreen mode
- Dark theme

---

## [0.1.0] - 2025-02-04

### Added
- Initial project setup
- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS styling
- Basic README documentation
