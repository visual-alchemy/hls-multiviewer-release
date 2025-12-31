"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import { Edit2, Trash2, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioVisualizer } from "./audio-visualizer"

interface VideoPlayerProps {
  url: string
  title: string
  onEdit: () => void
  onDelete: () => void
  isMuted: boolean
  isFullscreen: boolean
  playbackCommand: {
    action: "play" | "pause"
    id: number
  }
  startDelayMs?: number
}

export function VideoPlayer({
  url,
  title,
  onEdit,
  onDelete,
  isMuted,
  isFullscreen,
  playbackCommand,
  startDelayMs = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [hasFatalError, setHasFatalError] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const fatalTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recoverAttemptsRef = useRef(0)
  const showAlert = hasFatalError || isSilent
  const alertMessage = hasFatalError ? "Video Stalled" : isSilent ? "No Sound" : null

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const startTimer = setTimeout(() => {
      if (url.includes(".m3u8")) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            lowLatencyMode: false,
            liveSyncDurationCount: 4,
            liveMaxLatencyDurationCount: 20,
            backBufferLength: 120,
            maxMaxBufferLength: 90,
            maxBufferSize: 160 * 1024 * 1024,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 5,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetry: 5,
            xhrSetup: function (xhr, url) {
              xhr.setRequestHeader("x-monitoring-token", "monitoringtoken")
            },
          })
          hlsRef.current = hls
          hls.loadSource(url)
          hls.attachMedia(video)

          const handlePlaying = () => {
            setHasFatalError(false)
            setIsPaused(false)
            recoverAttemptsRef.current = 0
            if (fatalTimerRef.current) {
              clearTimeout(fatalTimerRef.current)
              fatalTimerRef.current = null
            }
          }

          video.addEventListener("playing", handlePlaying)

          hls.on(Hls.Events.ERROR, function (event, data) {
            console.log("HLS Error:", data)
            if (data.fatal) {
              // Immediately attempt recovery based on error type
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log("Network error, attempting startLoad recovery...")
                  hls.startLoad()
                  break
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log("Media error, attempting recoverMediaError...")
                  hls.recoverMediaError()
                  break
                default:
                  console.log("Unknown fatal error type:", data.type)
                  break
              }
              // Set timer for UI indication if recovery doesn't work
              if (!fatalTimerRef.current) {
                fatalTimerRef.current = setTimeout(() => {
                  setHasFatalError(true)
                  fatalTimerRef.current = null
                }, 10000)
              }
            }
          })

          return () => {
            video.removeEventListener("playing", handlePlaying)
            hls.destroy()
            hlsRef.current = null
            recoverAttemptsRef.current = 0
            if (fatalTimerRef.current) {
              clearTimeout(fatalTimerRef.current)
              fatalTimerRef.current = null
            }
          }
        }
      } else {
        video.src = url
      }
    }, startDelayMs)

    return () => {
      clearTimeout(startTimer)
    }
  }, [url, startDelayMs])

  useEffect(() => {
    if (!playbackCommand) return
    const video = videoRef.current
    if (!video) return
    if (playbackCommand.action === "play") {
      video.play().catch((err) => console.error("Error resuming video:", err))
      setIsPaused(false)
    } else {
      video.pause()
      setIsPaused(true)
    }
  }, [playbackCommand])

  const handleTogglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().then(() => setIsPaused(false)).catch((err) => console.error("Error resuming video:", err))
    } else {
      video.pause()
      setIsPaused(true)
    }
  }

  useEffect(() => {
    let audio: HTMLAudioElement | null = null
    if (showAlert) {
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
  }, [showAlert])

  useEffect(() => {
    if (!hasFatalError) {
      return
    }

    const hls = hlsRef.current
    const video = videoRef.current
    if (!hls || !video) {
      return
    }

    const retryInterval = setInterval(() => {
      console.log("Attempting to recover stream, attempt:", recoverAttemptsRef.current + 1)
      recoverAttemptsRef.current += 1

      // First try startLoad (handles network errors)
      hls.startLoad()

      // Also try recoverMediaError (handles media/codec errors)
      hls.recoverMediaError()

      // Every 3rd attempt: full reload of the source
      if (recoverAttemptsRef.current % 3 === 0) {
        console.log("Full reload of HLS source after repeated failures")
        hls.stopLoad()
        hls.detachMedia()
        hls.attachMedia(video)
        hls.loadSource(url)
        hls.startLoad()
      }

      // Always try to play after recovery attempt
      video.play().catch(err => console.log("Play after recovery failed:", err))
    }, 5000)

    return () => {
      clearInterval(retryInterval)
    }
  }, [hasFatalError, url])

  return (
    <div className={`relative rounded-lg overflow-hidden bg-black flex h-full w-full ${showAlert ? "blinking-border" : ""}`}>
      {/* Video element */}
      <div className="h-full w-full">
        <div className="relative h-full w-full">
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay />
          {alertMessage && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-white text-lg font-semibold drop-shadow">{alertMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Title bar with controls */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex justify-between items-center px-2 py-1 bg-black bg-opacity-50">
          <p className="text-white text-sm font-medium truncate">{title}</p>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={handleTogglePlayback}>
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
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
      <div className="absolute right-2 top-10 bottom-2 z-10 flex items-center">
        <AudioVisualizer videoRef={videoRef} isMuted={isMuted} onSilenceChange={setIsSilent} />
      </div>
    </div>
  )
}
