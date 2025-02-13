import type { Stream } from "./types"

let streams: Stream[] = []

export function getStreams(): Stream[] {
  return streams
}

export function saveStreams(newStreams: Stream[]): void {
  streams = newStreams
}

export type { Stream }

