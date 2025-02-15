import type { Stream } from "./types"

let streams: Stream[] = []

export const getStreams = (): Stream[] => {
  return streams
}

export const saveStreams = (newStreams: Stream[]): void => {
  streams = newStreams
  // Persist streams to local storage or database here.  For simplicity, this is omitted.
}

export type { Stream }

