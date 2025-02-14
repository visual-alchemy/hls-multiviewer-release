import { NextResponse } from "next/server"
import { saveStreams, type Stream } from "@/lib/streams"

export async function POST(request: Request) {
  const importedStreams: Stream[] = await request.json()
  saveStreams(importedStreams)
  return NextResponse.json(importedStreams)
}

