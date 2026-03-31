import { NextResponse } from "next/server"
import { saveStreams, type Stream } from "@/lib/streams"

export async function POST(request: Request) {
  try {
    const importedStreams: Stream[] = await request.json()
    if (!Array.isArray(importedStreams)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
    }
    const updatedStreams = importedStreams
    saveStreams(updatedStreams)
    return NextResponse.json(updatedStreams)
  } catch (error) {
    console.error("Error in import API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

