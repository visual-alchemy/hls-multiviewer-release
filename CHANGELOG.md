# Changelog

All notable changes to the HLS Multiviewer project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed
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
