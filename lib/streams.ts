import type { Stream } from "./types"

let streams: Stream[] = []

export const getStreams = (): Stream[] => {
  return streams
}

export const saveStreams = (newStreams: Stream[]): void => {
  streams = newStreams
  // Persist streams (e.g., using localStorage, a database, or a file system)
  // ... persistence logic here ...
}

export type { Stream }

