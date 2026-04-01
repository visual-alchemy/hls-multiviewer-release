"use client"

import { useEffect, useRef, useState } from "react"
import Hls from "hls.js"
import { Edit2, Trash2, Pause, Play, Bell, BellOff, Expand } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AudioVisualizer } from "./audio-visualizer"

interface VideoPlayerProps {
  url: string
  title: string
  onEdit: () => void
  onDelete: () => void
  onSolo?: () => void
  isMuted?: boolean
  isFullscreen?: boolean
  isSoloed?: boolean
  playbackCommand?: {
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
  onSolo,
  isMuted = false,
  isFullscreen = false,
  isSoloed = false,
  playbackCommand,
  startDelayMs = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [hasFatalError, setHasFatalError] = useState(false)
  const hasFatalErrorRef = useRef(false) // mirrors hasFatalError for use in stale closures
  const [hasStreamError, setHasStreamError] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isAlarmMuted, setIsAlarmMuted] = useState(false)
  const fatalTimerRef = useRef<NodeJS.Timeout | null>(null)
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null) // ref to the recovery interval so we can clear it immediately on recovery
  const isPermanentlyStoppedRef = useRef(false) // set on 403 — prevents retry loop firing
  const recoverAttemptsRef = useRef(0)
  const consecutiveErrorsRef = useRef(0)
  const lastPlayingTimeRef = useRef<number>(Date.now())
  const stallCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Video Stalled takes priority over No Sound when stream has errors
  const showAlert = hasFatalError || (isSilent && !hasStreamError)
  const alertMessage = hasFatalError ? "Video Stalled" : (isSilent && !hasStreamError) ? "No Sound" : null

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const startTimer = setTimeout(() => {
      if (url.includes(".m3u8")) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            liveSyncDurationCount: 8,
            liveMaxLatencyDurationCount: 25,
            liveDurationInfinity: true,
            backBufferLength: 120,
            maxMaxBufferLength: 90,
            maxBufferSize: 160 * 1024 * 1024,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 10,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetry: 10,
            xhrSetup: function (xhr, url) {
              xhr.setRequestHeader("x-monitoring-token", "monitoringtoken")
            },
          })
          hlsRef.current = hls
          hls.loadSource(url)
          hls.attachMedia(video)

          const handlePlaying = () => {
            setHasFatalError(false)
            hasFatalErrorRef.current = false
            setHasStreamError(false)
            setIsPaused(false)
            recoverAttemptsRef.current = 0
            consecutiveErrorsRef.current = 0
            lastPlayingTimeRef.current = Date.now()
            // Immediately clear the retry interval so it stops as soon as stream recovers
            if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current)
              retryIntervalRef.current = null
            }
            if (fatalTimerRef.current) {
              clearTimeout(fatalTimerRef.current)
              fatalTimerRef.current = null
            }
          }

          // Track video stall/waiting events
          // Uses a ref instead of state to avoid stale closure issues
          const handleStall = () => {
            // Guard: if alarm already active, do nothing (prevents log spam from repeated stalled/waiting events)
            if (hasFatalErrorRef.current) return
            const timeSinceLastPlaying = Date.now() - lastPlayingTimeRef.current
            if (timeSinceLastPlaying > 15000) {
              console.log("Video stalled for 15+ seconds, triggering alert")
              hasFatalErrorRef.current = true
              setHasFatalError(true)
            }
          }

          video.addEventListener("playing", handlePlaying)
          video.addEventListener("stalled", handleStall)
          video.addEventListener("waiting", handleStall)
          
          // Programmatic Autoplay Fallback
          // Attempt to play normally, if blocked, mute temporarily to bypass browser policy
          const playPromise = video.play()
          if (playPromise !== undefined) {
             playPromise.catch(error => {
               if (error.name === "NotAllowedError") {
                 console.log("Autoplay blocked. Temporarily muting video element to bypass policy...");
                 video.muted = true;
                 video.play().catch(e => console.error("Muted playback also failed:", e));
                 
                 // Restore unmuted state on next user interaction to bring visualizer back
                 const restoreAudioContext = () => {
                     if (video.muted) {
                         video.muted = false;
                         console.log("User interaction detected, video source unmuted for visualizer.");
                     }
                     document.removeEventListener('click', restoreAudioContext);
                     document.removeEventListener('keydown', restoreAudioContext);
                     document.removeEventListener('touchstart', restoreAudioContext);
                 };
                 
                 document.addEventListener('click', restoreAudioContext);
                 document.addEventListener('keydown', restoreAudioContext);
                 document.addEventListener('touchstart', restoreAudioContext);
               }
             });
          }

          hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
              console.error(`Fatal HLS Error (${title}):`, data.details)
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
            } else {
              // Check for 403: permanent token expiry / stream taken offline
              // No point retrying — stop immediately and show "Video Stalled"
              const httpCode = (data.response as any)?.code
              if (httpCode === 403) {
                console.warn(`Stream ${title}: received 403, token expired or stream offline. Stopping retries.`)
                hasFatalErrorRef.current = true // prevent stall timer/handleStall firing on top
                isPermanentlyStoppedRef.current = true // block retry useEffect
                setHasFatalError(true)
                hls.stopLoad()
                return
              }

              // Track non-fatal errors (like fragLoadError with 404s)
              // We only count network errors or actual buffer gaps as "consecutive" triggers
              // Ignore bufferStalledError as it is often self-healing and too frequent
              if (data.details !== 'bufferStalledError' && 
                  (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.details === 'bufferSeekOverHole')) {
                consecutiveErrorsRef.current += 1
                setHasStreamError(true)
                console.log(`Non-fatal error count (${title}):`, consecutiveErrorsRef.current, data.details)

                // If too many consecutive non-fatal errors, treat as stalled
                // Raised threshold from 3 to 10 for more patient recovery
                if (consecutiveErrorsRef.current >= 10) {
                  console.log(`Too many consecutive errors for ${title}, triggering stall alert`)
                  setHasFatalError(true)
                }
              }
            }
          })

          return () => {
            video.removeEventListener("playing", handlePlaying)
            video.removeEventListener("stalled", handleStall)
            video.removeEventListener("waiting", handleStall)
            hls.destroy()
            hlsRef.current = null
            recoverAttemptsRef.current = 0
            consecutiveErrorsRef.current = 0
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

  // Dynamically switch quality when solo mode changes
  useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return

    if (isSoloed) {
      console.log(`Setting stream ${title} to Auto Quality (Solo Mode)`)
      hls.currentLevel = -1 // Auto
    } else {
      console.log(`Setting stream ${title} to Low Quality (Grid Mode)`)
      hls.currentLevel = 0 // Lowest
    }
  }, [isSoloed, title])

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
    if (showAlert && !isAlarmMuted) {
      audio = new Audio("/alert.mp3")
      audio.loop = true
      audio.play().catch(e => {
          // Silent catch for play interruptions (AbortError)
      })
    }
    return () => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }
  }, [showAlert, isAlarmMuted])

  useEffect(() => {
    if (!hasFatalError || isPermanentlyStoppedRef.current) {
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

      // Reset consecutive error count on recovery attempt
      consecutiveErrorsRef.current = 0

      // Full reload of manifest every attempt to discover new segments
      console.log("Reloading HLS manifest...")
      hls.stopLoad()
      hls.loadSource(url)
      hls.startLoad()

      // Also try recoverMediaError in case of codec issues
      hls.recoverMediaError()

      // Always try to play after recovery attempt
      video.play().catch(err => console.log("Play after recovery failed:", err))
    }, 5000)

    retryIntervalRef.current = retryInterval

    return () => {
      clearInterval(retryInterval)
      retryIntervalRef.current = null
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
            {onSolo && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSolo}
                className="h-6 w-6 text-white hover:bg-black/20"
                title="Solo Stream"
              >
                <Expand className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={() => setIsAlarmMuted(!isAlarmMuted)}>
              {isAlarmMuted ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
            </Button>
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
        <AudioVisualizer videoRef={videoRef} isMuted={isMuted} onSilenceChange={setIsSilent} hasStreamError={hasStreamError} />
      </div>
    </div>
  )
}
