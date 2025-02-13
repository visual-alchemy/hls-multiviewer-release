import { NextResponse } from "next/server"
import { getStreams, saveStreams, type Stream } from "@/lib/streams"

// GET handler to retrieve all streams
export async function GET() {
  const streams = getStreams()
  return NextResponse.json(streams)
}

// POST handler to add a new stream
export async function POST(request: Request) {
  const streams = getStreams()
  const newStream: Omit<Stream, "id"> = await request.json()
  const updatedStreams = [...streams, { ...newStream, id: Date.now().toString() }]
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

// PUT handler to update an existing stream
export async function PUT(request: Request) {
  const streams = getStreams()
  const updatedStream: Stream = await request.json()
  const updatedStreams = streams.map((stream) => (stream.id === updatedStream.id ? updatedStream : stream))
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

// DELETE handler to remove a stream
export async function DELETE(request: Request) {
  const { id } = await request.json()
  const streams = getStreams()
  const updatedStreams = streams.filter((stream) => stream.id !== id)
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

