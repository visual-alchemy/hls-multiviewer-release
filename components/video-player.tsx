"use client"

import { useEffect, useRef, useState } from "react"
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
  isFullscreen: boolean
}

export function VideoPlayer({ url, title, onEdit, onDelete, isMuted, isFullscreen }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxMaxBufferLength: 30,
          maxBufferSize: 60 * 1024 * 1024,
          backBufferLength: 10,
          xhrSetup: function (xhr, url) {
            xhr.setRequestHeader("x-monitoring-token", "monitoringtoken")
          },
        })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(video)

        const handlePlaying = () => {
          setHasError(false)
        }

        video.addEventListener("playing", handlePlaying)

        hls.on(Hls.Events.ERROR, function (event, data) {
          console.log("HLS Error:", data)
          if (data.fatal) {
            setHasError(true)
          }
        })

        return () => {
          video.removeEventListener("playing", handlePlaying)
          hls.destroy()
          hlsRef.current = null
        }
      }
    } else {
      video.src = url
    }
  }, [url])

  useEffect(() => {
    let audio: HTMLAudioElement | null = null
    if (hasError) {
      audio = new Audio("/alert.mp3")
      audio.loop = true
      audio.play().catch(e => console.error("Error playing audio:", e))
    }
    return () => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }
  }, [hasError])

  useEffect(() => {
    if (!hasError) {
      return
    }

    const hls = hlsRef.current
    if (!hls) {
      return
    }

    const retryInterval = setInterval(() => {
      console.log("Attempting to recover stream...")
      hls.recoverMediaError()
    }, 5000)

    return () => {
      clearInterval(retryInterval)
    }
  }, [hasError])

  return (
    <div className={`relative rounded-lg overflow-hidden bg-black flex h-full w-full ${hasError ? "blinking-border" : ""}`}>
      {/* Video element */}
      <video ref={videoRef} className="w-full h-full object-contain" autoPlay />

      {/* Title bar with controls */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex justify-between items-center px-2 py-1 bg-black bg-opacity-50">
          <p className="text-white text-sm font-medium truncate">{title}</p>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={onEdit}>
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Audio visualizer (also handles audio routing/muting) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
        <AudioVisualizer videoRef={videoRef} isMuted={isMuted} />
      </div>
    </div>
  )
}
