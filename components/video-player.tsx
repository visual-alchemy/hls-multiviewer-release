"use client"

import { useEffect, useRef } from "react"
import Hls from "hls.js"
import { Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioVisualizer } from "./audio-visualizer"

interface VideoPlayerProps {
  url: string
  title: string
  onEdit: () => void
  onDelete: () => void
  isMuted: boolean
}

export function VideoPlayer({ url, title, onEdit, onDelete, isMuted }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls()
        hls.loadSource(url)
        hls.attachMedia(video)
        return () => {
          hls.destroy()
        }
      }
    } else {
      video.src = url
    }
  }, [url])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.muted = isMuted
    }
  }, [isMuted])

  return (
    <div className="relative rounded-lg overflow-hidden bg-black flex">
      <video ref={videoRef} className="w-full h-full object-contain" autoPlay />

      {/* Title in top-left */}
      <div className="absolute top-2 left-2 z-10">
        <p className="text-white text-sm font-medium">{title}</p>
      </div>

      {/* Controls in top-right */}
      <div className="absolute top-2 right-2 flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
          onClick={onEdit}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-black/50 hover:bg-black/70 text-white"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Audio visualizer on the right */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-[60%]">
        <AudioVisualizer videoRef={videoRef} />
      </div>
    </div>
  )
}

