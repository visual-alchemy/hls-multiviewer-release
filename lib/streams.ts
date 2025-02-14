// lib/streams.ts
import type { Stream } from "./types"

let streams: Stream[] = []

export function getStreams(): Stream[] {
  return streams
}

export function saveStreams(newStreams: Stream[]): void {
  streams = newStreams
  // In a real application, you would likely persist streams to a database or local storage here.
}

export type { Stream }

