# Changelog

All notable changes to the HLS Multiviewer project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

---

## [2.0.0] - 2026-04-01

### Added
- **Multi-instance Docker deployment**: isolated instances (`primary-1` port 3111, `event-1` port 3115, `konten-1` port 3116) each with dedicated Docker volumes
- **Stream Offline alarm**: detects HTTP 403 responses (expired token / stream taken down) and shows "Stream Offline" label — stops all retries immediately instead of hammering the CDN
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
