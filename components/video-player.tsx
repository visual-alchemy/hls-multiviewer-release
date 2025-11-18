"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
  const [isStalled, setIsStalled] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [errorTypes, setErrorTypes] = useState<string[]>([])
  const lastTime = useRef(0)
  const lastFrame = useRef<ImageData | null>(null)
  const silenceStartTime = useRef<number | null>(null)
  const stallStartTime = useRef<number | null>(null)

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
          setErrorTypes([])
          setIsStalled(false)
          setIsSilent(false)
        }

        video.addEventListener("playing", handlePlaying)

        hls.on(Hls.Events.ERROR, function (event, data) {
          console.log("HLS Error:", data)
          if (data.fatal) {
            setHasError(true)
            setErrorTypes(prev => [...prev, "Stream Error"])
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
    const video = videoRef.current
    if (video) {
      video.muted = isMuted
    }
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const checkStallAndSilence = () => {
      if (video.paused || video.seeking) return

      // Stall detection (Image difference comparison)
      const canvas = document.createElement("canvas")
      canvas.width = 16
      canvas.height = 9
      const context = canvas.getContext("2d")
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height)

        if (lastFrame.current) {
          let diff = 0
          for (let i = 0; i < currentFrame.data.length; i++) {
            diff += Math.abs(currentFrame.data[i] - lastFrame.current.data[i])
          }

          if (diff < 1000) { // Adjust sensivity threshold as needed
            if (stallStartTime.current === null) {
              stallStartTime.current = Date.now()
            } else if (Date.now() - stallStartTime.current > 2500) {
              setIsStalled(true)
              setErrorTypes(prev => (prev.includes("Video Stalled") ? prev : [...prev, "Video Stalled"]))
            }
          } else {
            stallStartTime.current = null
            setIsStalled(false)
            setErrorTypes(prev => prev.filter(e => e !== "Video Stalled"))
          }
        }
        lastFrame.current = currentFrame
      }
    }

    const interval = setInterval(checkStallAndSilence, 2500)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let audio: HTMLAudioElement | null = null
    if (hasError || isStalled || isSilent) {
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
  }, [hasError, isStalled, isSilent])

  useEffect(() => {
    if (!hasError && !isStalled && !isSilent) {
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
  }, [hasFatalError])

  return (
    <div className={`relative rounded-lg overflow-hidden bg-black flex h-full w-full ${hasError || isStalled || isSilent ? "blinking-border" : ""}`}>
      {errorTypes.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-50">
          <p className="text-white text-lg font-bold">{errorTypes.join(", ")}</p>
        </div>
      )}
      {/* Video element */}
      <video ref={videoRef} className="w-full h-full object-contain" autoPlay crossOrigin="anonymous" />

      {/* Title bar with controls */}
      <div className="absolute top-0 left-0 right-0 z-20">
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
        <AudioVisualizer
          videoRef={videoRef}
          onAudioData={useCallback(
            (dataArray: Uint8Array) => {
              const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length
              const silenceThreshold = 0.5 // Adjust this threshold as needed
              // console.log(`Average volume for ${title}: ${average}`)

              if (average < silenceThreshold) {
                if (silenceStartTime.current === null) {
                  silenceStartTime.current = Date.now()
                } else if (Date.now() - silenceStartTime.current > 2500) {
                  setIsSilent(true)
                  setErrorTypes(prev => (prev.includes("No Sound") ? prev : [...prev, "No Sound"]))
                }
              } else {
                silenceStartTime.current = null
                setIsSilent(false)
                setErrorTypes(prev => prev.filter(e => e !== "No Sound"))
              }
            },
            []
          )}
        />
      </div>
    </div>
  )
}
