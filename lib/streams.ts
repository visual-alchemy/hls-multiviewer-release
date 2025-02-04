import fs from "fs"
import path from "path"

export interface Stream {
  id: string
  title: string
  url: string
}

const STREAMS_FILE = path.join(process.cwd(), "data", "streams.json")

export function getStreams(): Stream[] {
  if (!fs.existsSync(STREAMS_FILE)) {
    return []
  }
  const data = fs.readFileSync(STREAMS_FILE, "utf-8")
  return JSON.parse(data)
}

export function saveStreams(streams: Stream[]): void {
  const dir = path.dirname(STREAMS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(STREAMS_FILE, JSON.stringify(streams, null, 2))
}

