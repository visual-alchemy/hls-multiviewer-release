import type { Stream } from "./types"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const STREAMS_FILE = path.join(DATA_DIR, "streams.json")

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Ensure the streams file exists with an empty array if not present
if (!fs.existsSync(STREAMS_FILE)) {
  fs.writeFileSync(STREAMS_FILE, JSON.stringify([]), "utf-8")
}

export const getStreams = (): Stream[] => {
  try {
    const data = fs.readFileSync(STREAMS_FILE, "utf-8")
    return JSON.parse(data) as Stream[]
  } catch (error) {
    console.error("Error reading streams from file:", error)
    return []
  }
}

export const saveStreams = (newStreams: Stream[]): void => {
  try {
    fs.writeFileSync(STREAMS_FILE, JSON.stringify(newStreams, null, 2), "utf-8")
  } catch (error) {
    console.error("Error writing streams to file:", error)
  }
}

export type { Stream }

