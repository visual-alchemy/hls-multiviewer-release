"use client"

import { useEffect, useRef } from "react"
import Hls from "hls.js"
import { Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioVisualizer } from "./audio-visualizer"

// Define the props for the VideoPlayer component
interface VideoPlayerProps {
  url: string
  title: string
  onEdit: () => void
  onDelete: () => void
  isMuted: boolean
}

export function VideoPlayer({ url, title, onEdit, onDelete, isMuted }: VideoPlayerProps) {
  // Reference to the video element
  const videoRef = useRef<HTMLVideoElement>(null)

  // Effect to set up the video player and HLS if needed
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

  // Effect to update mute state when global mute changes
  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.muted = isMuted
    }
  }, [isMuted])

  return (
    <div className="relative rounded-lg overflow-hidden bg-black flex">
      {/* Video element */}
      <video ref={videoRef} className="w-full h-full object-contain" autoPlay />

      {/* Title bar with controls */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex justify-between items-center px-2 py-1 bg-black bg-opacity-30">
          <p className="text-white text-sm font-medium">{title}</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={onEdit}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Audio visualizer */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-[60%]">
        <AudioVisualizer videoRef={videoRef} />
      </div>
    </div>
  )
}

