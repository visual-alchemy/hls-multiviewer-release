import { describe, it, expect, beforeEach } from "vitest"
import { streamLog, getLogs, getLogsByStream, clearLogs } from "@/lib/logger"

describe("logger", () => {
  beforeEach(() => {
    clearLogs()
  })

  it("appends entries to the ring buffer", () => {
    streamLog("test", "playing", "play_recovered", "log", "stream is playing")
    const logs = getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].stream).toBe("test")
    expect(logs[0].state).toBe("playing")
    expect(logs[0].event).toBe("play_recovered")
  })

  it("filters logs by stream", () => {
    streamLog("stream-a", "stalled", "http_403", "warn", "403 error")
    streamLog("stream-b", "playing", "play_recovered", "log", "playing")
    streamLog("stream-a", "recovering", "recover_attempt", "log", "recovery attempt 1")

    const aLogs = getLogsByStream("stream-a")
    expect(aLogs.length).toBe(2)
  })

  it("includes data in entries", () => {
    streamLog("test", "stalled", "timecode_stall", "warn", "stalled", { currentTime: 42.5, timeSinceUpdate: 15000 })
    const logs = getLogs()
    expect(logs[0].data).toEqual({ currentTime: 42.5, timeSinceUpdate: 15000 })
  })

  it("caps at 10000 entries", () => {
    for (let i = 0; i < 10005; i++) {
      streamLog("test", "playing", "play_recovered", "log", `entry ${i}`)
    }
    expect(getLogs().length).toBe(10000)
  })
})
