// Structured logger — writes to console AND a ring buffer.
// Buffer is exposed at window.__multiviewer_logs for inspection without dev tools.

type LogState = "playing" | "stalled" | "recovering" | "black" | "silent" | "resolving" | "init"
type LogEvent = "play_recovered" | "timecode_stall" | "silence_frozen" | "fatal_error" |
  "circuit_breaker" | "visual_freeze" | "black_detect" | "black_clear" |
  "true_silence" | "recover_attempt" | "recover_failed" |
  "http_403" | "http_502" | "level_parse" | "network_error" |
  "url_resolve_ok" | "url_resolve_fail" | "correlation_banner"

interface LogEntry {
  stream: string
  state: LogState
  event: LogEvent
  timestamp: number
  data?: unknown
}

const MAX_ENTRIES = 10000
const ringBuffer: LogEntry[] = []

export function streamLog(
  stream: string,
  state: LogState,
  event: LogEvent,
  level: "log" | "warn" | "error",
  message: string,
  data?: unknown,
) {
  const entry: LogEntry = { stream, state, event, timestamp: Date.now() }
  if (data !== undefined) entry.data = data
  ringBuffer.push(entry)
  if (ringBuffer.length > MAX_ENTRIES) ringBuffer.shift()

  const prefix = `[${stream}]`
  if (data !== undefined) {
    console[level](prefix, message, data)
  } else {
    console[level](prefix, message)
  }
}

export function getLogs(): LogEntry[] {
  return [...ringBuffer]
}

export function getLogsByStream(stream: string): LogEntry[] {
  return ringBuffer.filter((e) => e.stream === stream)
}

export function clearLogs() {
  ringBuffer.length = 0
}
