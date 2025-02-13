import { NextResponse } from "next/server"
import { getStreams, saveStreams, type Stream } from "@/lib/streams"

export async function GET() {
  const streams = getStreams()
  return NextResponse.json(streams)
}

export async function POST(request: Request) {
  const streams = getStreams()
  const newStream: Omit<Stream, "id"> = await request.json()
  const updatedStreams = [...streams, { ...newStream, id: Date.now().toString() }]
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

export async function PUT(request: Request) {
  const streams = getStreams()
  const updatedStream: Stream = await request.json()
  const updatedStreams = streams.map((stream) => (stream.id === updatedStream.id ? updatedStream : stream))
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  const streams = getStreams()
  const updatedStreams = streams.filter((stream) => stream.id !== id)
  saveStreams(updatedStreams)
  return NextResponse.json(updatedStreams)
}

