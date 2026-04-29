# Technical Analysis — Vidio HLS Multiviewer

> **Version:** 2.1.1 (feat/vidio)
> **Date:** April 2026
> **Author:** Engineering Analysis

---

## 1. Project Overview

The Vidio HLS Multiviewer is a browser-based live stream monitoring dashboard built to display up to 42 concurrent HLS streams (6×7 grid) on a single screen. It is used by the Vidio operations team to monitor live broadcast quality in real time.

Key operational characteristics:
- 25 streams active concurrently in the primary production instance
- Streams sourced from Akamai CDN with HDNTL token-based authentication
- Deployed on an internal LAN host (`192.168.50.96`) accessed from a monitoring station
- All CDN requests are proxied through an OpenResty reverse proxy to handle CORS and `master.m3u8` quality filtering

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js (App Router) | ^14.2.33 |
| UI Language | TypeScript | ^5 |
| Styling | Tailwind CSS + shadcn/ui | ^3.4.17 |
| HLS Playback | hls.js | latest |
| Component Library | Radix UI (via shadcn/ui) | various |
| Reverse Proxy | OpenResty (nginx + LuaJIT) | alpine |
| Containerization | Docker + Docker Compose | — |
| Node Runtime | Node.js | 18 (alpine) |

---

## 3. Architecture

### 3.1 High-Level Topology

```
Browser (Monitoring Station)
    │
    ▼
OpenResty Proxy (port 3111 / 3115 / 3116)
    │   ├── Proxies /  → Next.js App (port 3111, internal)
    │   ├── Proxies /:akamai_host/stream/* → Akamai CDN (raw segments)
    │   └── Proxies /primary|backup/:host/stream/*.m3u8 → Akamai CDN
    │         └── Lua body_filter: strips all quality levels except 360p
    ▼
Next.js App (Node 18, production build)
    │   ├── /app/api/streams → CRUD on streams.json (filesystem)
    │   └── /app/api/streams/import → Bulk replace streams.json
    ▼
hls.js (in-browser)
    └── Fetches segments via OpenResty proxy (same origin, no CORS issues)
```

### 3.2 Multi-Instance Deployment

Three isolated dashboard instances run in a single `docker-compose.yml`:

| Instance | External Port | Data Volume | Purpose |
|---|---|---|---|
| `app-primary-1` | 3111 | `./data_primary_1` | Primary broadcast monitoring |
| `app-event-1` | 3115 | `./data_event_1` | Event monitoring |
| `app-konten-1` | 3116 | `./data_konten_1` | Content monitoring |

Each instance has a dedicated OpenResty proxy container and its own isolated `streams.json` data file. All containers share a single Docker bridge network (`10.5.0.0/16`).

### 3.3 Stream Data Persistence

Streams are stored as flat JSON files on the container's mounted volume (`/app/data/streams.json`). There is no database. The API routes (`/api/streams`) read and write this file directly using the Node.js `fs` module. This is appropriate for the scale (≤42 streams), but means stream data survives container restarts only because of the host-mounted volume.

---

## 4. Component Architecture

### 4.1 `MultiViewer` (`multiviewer.tsx`) — Orchestrator

The root component. Responsibilities:

- Fetches stream list from `/api/streams` on mount
- Renders the configurable grid (`gridRows × gridColumns`) via `Array.from()`
- Manages global state: mute, pause, fullscreen, solo mode, grid config
- Handles the **soft reload mechanism** (see §5.1)
- Passes `onFatalError` callback down to each `VideoPlayer`
- Injects a `softReload=N` query parameter into all stream URLs on reload to bust CDN/HLS.js caches
- Staggers player initialization with `startDelayMs = staggerSeed + index * 300` to avoid 25 simultaneous HLS manifest requests on page load

### 4.2 `VideoPlayer` (`video-player.tsx`) — Stream Playback Engine

The most complex component. Responsibilities:

- Initializes and manages a dedicated `hls.js` instance per stream
- Implements a multi-path **error recovery system** (see §5.2)
- Manages the following refs to avoid stale closure bugs:
  - `hasFatalErrorRef` — mirrors `hasFatalError` state
  - `fatalErrorTypeRef` — records `"403"` or `"stream_down"` at detection time
  - `isPausedRef` — prevents recovery from firing on manually paused streams
  - `isAlarmMutedRef` — prevents dashboard reload from firing when alarm is silenced
  - `isPermanentlyStoppedRef` — stops recovery after escalation
  - `retryIntervalRef` — single source of truth for the running interval handle
- Implements **circuit breaker**: after 10 consecutive non-fatal errors, calls `hls.stopLoad()` to prevent `ERR_INSUFFICIENT_RESOURCES` browser crashes
- Handles **autoplay policy**: mutes temporarily if `NotAllowedError`, restores audio on next user interaction

### 4.3 `AudioVisualizer` (`audio-visualizer.tsx`) — Silence Detection

- Creates a `Web Audio API` graph: `MediaElementAudioSourceNode → ChannelSplitterNode → AnalyserNode (L+R) → GainNode → AudioContext.destination`
- Renders a stereo segmented bar meter on a `<canvas>` at ~30 FPS using `requestAnimationFrame`
- Silence detection runs on a **`setInterval(100ms)`** (not rAF) so it continues working in background/hidden tabs
- Reports silence after 10 seconds below `0.01` RMS threshold via `onSilenceChange` callback
- The `hasStreamError` prop suppresses the silence alarm when the stream itself is already erroring, preventing false positives

### 4.4 OpenResty Proxy (`nginx_proxy.conf.template`) — CDN Relay

The proxy serves two critical functions:

**1. CORS bypass**: All HLS segment and manifest requests go through the same origin, eliminating cross-origin issues with the Akamai CDN.

**2. Manifest quality filtering (Lua `body_filter`)**: The `/primary|backup/:host/stream/*.m3u8` location intercepts the master playlist response and rewrites it to contain only the `360p AVC` rendition. This reduces browser bandwidth and decoding load significantly when monitoring 25 streams simultaneously.

The Lua filter handles three playlist formats:
- Standard multi-bitrate HLS with `EXT-X-MEDIA` audio groups
- Non-EXT-X-MEDIA format (stream-only URI matching)
- DRM HLS (`/drm/hls/` path pattern, filters by `hls-p`/`hls-b` ingest type)

**Spoofed headers** sent upstream to Akamai:
```
Origin: https://www.vidio.com
Referer: https://www.vidio.com
User-Agent: Mozilla/5.0 ... OpsMonitoring
x-monitoring-token: monitoringtoken  (set by hls.js xhrSetup)
```

---

## 5. Error Recovery System (Deep Dive)

This is the most engineered part of the codebase, having gone through multiple iterations to fix real production bugs.

### 5.1 Dashboard-Level: Soft Reload Mechanism

When a `VideoPlayer` cannot recover a stream, it calls `onFatalError("token_expired" | "stream_down")`. The multiviewer responds:

```
onFatalError called
    → setFatalErrorCount(prev + 1)
    → useEffect([fatalErrorCount]) fires
    → setTimeout(5000) set (via ref, not state, to avoid premature cancel)
    → After 5s: setSoftReloadKey(prev + 1), setFatalErrorCount(0)
    → All VideoPlayer key props change → React fully unmounts + remounts them
    → New HLS instances created with fresh state, cache-busted URLs
```

The `softReloadKey` is embedded in the React `key` prop of each video tile's wrapper div:
```tsx
key={`${stream ? stream.id : index}-${softReloadKey}`}
```

This is functionally equivalent to a browser F5 refresh but scoped to the video grid, preserving fullscreen state and the header controls.

### 5.2 Player-Level: Multi-Path Recovery Loop

When `hasFatalError` becomes `true`, a recovery `useEffect` fires. The path taken depends on `fatalErrorTypeRef.current` (set **before** the state update to avoid closure timing issues):

```
hasFatalError = true
    ├── fatalErrorTypeRef = "403"  →  403 recovery path
    │       ├── Reinit HLS every 5s, up to 6 attempts (30s)
    │       ├── If still failing → onFatalError("token_expired") → dashboard soft reload
    │       └── If alarm muted → reset counter silently, keep retrying
    │
    └── fatalErrorTypeRef = "stream_down"  →  stream-down path
            ├── Reinit HLS every 5s, retry indefinitely
            ├── Counter resets at 6 (no dashboard reload triggered)
            ├── If stream comes back → handlePlaying() clears all state
            └── If reinit gets 403 (stream back but token issue) → escalate to dashboard reload

Guard: if retryIntervalRef.current !== null → skip (prevents duplicate intervals)
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| `fatalErrorTypeRef` set before `setHasFatalError` | `useEffect` reads the ref synchronously before interval starts — no async closure race |
| `retryIntervalRef !== null` guard | `hasFatalError` can be set `true` multiple times while already recovering (stall handler re-fires); without this guard, N simultaneous intervals destroy each other's HLS instances |
| `isPermanentlyStoppedRef` reset in `handlePlaying` | Allows future recovery cycles after a successful reconnect |
| Circuit breaker at 10 non-fatal errors | Prevents `ERR_INSUFFICIENT_RESOURCES` from thousands of tight-loop socket requests when CDN returns errors at CPU speed |

---

## 6. HLS.js Configuration

Each player instance (both initial and reinit) uses:

```js
{
  enableWorker: true,           // offloads demux/decrypt to Web Worker
  lowLatencyMode: false,        // standard latency (live TV, not WebRTC)
  liveSyncDurationCount: 8,     // stay 8 segments behind live edge
  liveMaxLatencyDurationCount: 25,
  liveDurationInfinity: true,   // prevent playlist end detection on live
  backBufferLength: 120,        // 2 min back buffer
  maxMaxBufferLength: 90,
  maxBufferSize: 160 * 1024 * 1024,  // 160MB buffer per stream
  fragLoadingRetryDelay: 1000,
  fragLoadingMaxRetry: 10,
  manifestLoadingRetryDelay: 1000,
  manifestLoadingMaxRetry: 10,
}
```

> **Note on `maxBufferSize`**: 160MB × 25 streams = up to **4GB** of browser-allocated buffer memory in theory. In practice, streams at 360p use far less, but this is worth monitoring on low-RAM monitoring stations.

---

## 7. Known Issues & Limitations

### 7.1 Browser Resource Ceiling

Chrome has a hard limit on concurrent `WebMediaPlayer` instances (typically 16–24). With 25 streams, the dashboard is near or above this ceiling. Symptoms:
- `net::ERR_INSUFFICIENT_RESOURCES` on HLS segment fetches
- Some streams silently fail to initialize on page load
- The circuit breaker (§5.2) mitigates the cascading effect but does not eliminate the root cause

**Mitigation in place**: Circuit breaker stops hammering the CDN when errors spike.
**Not yet addressed**: Lazy initialization — streams outside the visible viewport could be suspended.

### 7.2 Stale Segment URLs After Stream-Down Recovery

When a stream goes offline and comes back, the stored HLS URL in `streams.json` may point to a stale segment index (e.g., `index-1776563950.m3u8`). The reinit HLS instance requests this stale index, which may return 404, forcing another reinit cycle. The dashboard only cache-busts the master `.m3u8` URL, not the segment index — this is handled by HLS.js's own retry logic.

### 7.3 No Health Monitoring API

There is no server-side health check for individual streams. The only health signal comes from the browser's playback state. If the monitoring station browser is not active (tab hidden, screen locked), silence detection continues but video stall detection may be degraded.

### 7.4 Flat-File Stream Storage

`streams.json` is not atomic. A crash mid-write could corrupt the file. For the current scale this is acceptable, but concurrent writes from multiple browser tabs on the same instance could cause data loss.

### 7.5 Single Deployment Host

All instances (`primary-1`, `event-1`, `konten-1`) run on the same physical host. If the host goes down, all dashboards go down simultaneously. No redundancy or failover is configured.

---

## 8. Data Flow Diagram

```
User adds stream via UI
    → POST /api/streams (Next.js route)
    → streams.json updated on volume
    → React state updated, VideoPlayer mounted

VideoPlayer mounts
    → startDelayMs timer fires
    → hls.js created, loadSource(url), attachMedia(video)
    → OpenResty proxy intercepts /primary/:host/stream/master.m3u8
    → Lua filter strips all renditions except 360p
    → hls.js receives single-rendition playlist
    → Segments fetched via /:akamai_host/stream/* proxy location
    → Segments proxied directly (no Lua processing, no buffering)
    → Video plays

Stream error occurs
    → hls.js ERROR event fires in VideoPlayer
    → Error classified: 403 → fatalErrorTypeRef="403" | 10x network → "stream_down"
    → hasFatalError=true → recovery useEffect fires
    → Recovery interval starts (5s tick)
    → 403 path: up to 6 reinits → onFatalError → multiviewer softReload
    → Stream-down path: infinite reinits → resolves when stream returns
```

---

## 9. Improvement Recommendations

### Priority 1 — Resource Management
- Implement **lazy stream initialization**: only fully initialize HLS instances for streams currently visible in the viewport. Streams outside view should remain in a "standby" state (no active `WebMediaPlayer`).
- Consider **virtual scrolling** or a **pagination mode** for grids larger than ~16 panels.

### Priority 2 — Proxy Stability
- Remove the debug `ngx.log(ngx.ERR, ...)` statements from the Lua filter — these write to the OpenResty error log on every manifest request and can generate significant disk I/O with 25 streams.
- Add a `/health` endpoint that checks if the Next.js upstream is responding, enabling Docker healthcheck integration.

### Priority 3 — Observability
- Add a server-side stream health API that periodically HEAD-requests each stream's master playlist and reports status. This would allow detection of stream outages even when no browser is active.
- Persist the browser log to a rolling file server-side (not just on the client) so post-incident analysis does not require the client to have kept the log file.

### Priority 4 — Resilience
- Move `streams.json` writes to use atomic rename (`write to .tmp → rename`) to prevent corruption on crash.
- Add a `docker-compose.override.yml` pattern to support a hot-standby host for the primary instance.

---

## 10. Version History Summary

| Version | Date | Key Change |
|---|---|---|
| 0.3.0 | Feb 2025 | Initial multiviewer with HLS.js + audio visualizer |
| 0.8.0 | Sep 2025 | Docker + Caddy support |
| 1.0.0 | Nov 2025 | Audio silence alerting |
| 1.1.0 | Nov 2025 | Global + per-tile play/pause |
| 2.0.0 | Apr 2026 | Multi-instance Docker, 403 detection, import dialog, NGINX proxy |
| 2.1.0 | Apr 2026 | Full HLS instance recreation on recovery, 403 mid-recovery guard |
| 2.1.1 | Apr 2026 | Mute alarm skips reload, React timer cleanup bug fixed |
| 2.1.2+ | Apr 2026 | `fatalErrorTypeRef` (closure bug fix), circuit breaker, duplicate interval guard |
