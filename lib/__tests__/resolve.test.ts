import { describe, it, expect } from "vitest"
import { findM3u8Urls, describeJsonStructure } from "@/lib/resolve"

describe("findM3u8Urls", () => {
  it("finds m3u8 URL at top level", () => {
    const data = { stream_url: "https://cdn.example.com/stream/master.m3u8?token=abc" }
    const urls = findM3u8Urls(data)
    expect(urls).toEqual(["https://cdn.example.com/stream/master.m3u8?token=abc"])
  })

  it("finds m3u8 URL nested deeply", () => {
    const data = {
      data: {
        stream: { primary: { url: "https://cdn.example.com/video.m3u8" } },
      },
    }
    const urls = findM3u8Urls(data)
    expect(urls).toContain("https://cdn.example.com/video.m3u8")
  })

  it("finds multiple m3u8 URLs (sorts longest first)", () => {
    const data = {
      master: "https://cdn.example.com/playlist/master.m3u8",
      audio: "https://cdn.example.com/playlist/audio.m3u8",
    }
    const urls = findM3u8Urls(data)
    expect(urls[0]).toContain("master.m3u8")
    expect(urls.length).toBe(2)
  })

  it("returns empty array when no m3u8 found", () => {
    const data = { error: "stream not found", code: 404 }
    const urls = findM3u8Urls(data)
    expect(urls).toEqual([])
  })

  it("handles arrays", () => {
    const data = { renditions: [{ url: "https://cdn.example.com/360p.m3u8" }, { url: "https://cdn.example.com/720p.m3u8" }] }
    const urls = findM3u8Urls(data)
    expect(urls.length).toBe(2)
  })
})

describe("describeJsonStructure", () => {
  it("describes top-level keys", () => {
    const data = { stream_url: "https://cdn.example.com/video.m3u8", code: 200, live: true }
    const structure = describeJsonStructure(data)
    expect(structure).toContainEqual(expect.stringContaining("stream_url: string"))
    expect(structure).toContainEqual(expect.stringContaining("code: number"))
    expect(structure).toContainEqual(expect.stringContaining("live: boolean"))
  })
})
