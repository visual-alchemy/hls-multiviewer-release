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
  onFatalError?: (reason: "token_expired" | "stream_down") => void
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
  onFatalError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [hasFatalError, setHasFatalError] = useState(false)
  const hasFatalErrorRef = useRef(false) // mirrors hasFatalError for use in stale closures
  const [hasStreamError, setHasStreamError] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false) // mirrors isPaused for the setInterval closure
  const [isAlarmMuted, setIsAlarmMuted] = useState(false)
  const isAlarmMutedRef = useRef(false) // mirrors isAlarmMuted for the setInterval closure
  const fatalTimerRef = useRef<NodeJS.Timeout | null>(null)
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null) // ref to the recovery interval so we can clear it immediately on recovery
  const isPermanentlyStoppedRef = useRef(false) // set when recovery permanently gives up
  const recoverAttemptsRef = useRef(0)
  const consecutiveErrorsRef = useRef(0)
  // Records the type of error that triggered hasFatalError, so the recovery interval
  // knows from tick 1 whether to do a 403-path (dashboard reload) or stream-down (silent retry).
  const fatalErrorTypeRef = useRef<"403" | "stream_down" | null>(null)
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
            fatalErrorTypeRef.current = null // reset error type on successful recovery
            setHasStreamError(false)
            setIsPaused(false)
            isPausedRef.current = false
            recoverAttemptsRef.current = 0
            consecutiveErrorsRef.current = 0
            isPermanentlyStoppedRef.current = false // allow future recovery attempts
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
              if (!fatalTimerRef.current) {
                fatalTimerRef.current = setTimeout(() => {
                  setHasFatalError(true)
                  fatalTimerRef.current = null
                }, 10000)
              }
            } else {
              const httpCode = (data.response as any)?.code
              if (httpCode === 403) {
                // 403: immediate stop + record error type BEFORE setting hasFatalError.
                // fatalErrorTypeRef being set here (before the state update) ensures the
                // recovery interval reads "403" from tick 1, not "stream_down".
                console.warn(`[${title}] 403 received. Recording error type and entering recovery loop.`)
                fatalErrorTypeRef.current = "403"
                hasFatalErrorRef.current = true
                hls.stopLoad()
                setHasFatalError(true)
                return
              }

              // Non-fatal network errors: count toward circuit breaker threshold.
              // Once threshold hit, stop loading to prevent ERR_INSUFFICIENT_RESOURCES
              // browser crash from thousands of tight-loop requests.
              // bufferStalledError is excluded as it is self-healing and very frequent.
              if (data.details !== 'bufferStalledError' &&
                  (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.details === 'bufferSeekOverHole')) {
                consecutiveErrorsRef.current += 1
                setHasStreamError(true)

                if (consecutiveErrorsRef.current >= 10) {
                  // Circuit breaker: stream is effectively down (404, network error, etc.)
                  // Stop making requests and enter the silent retry loop.
                  console.log(`[${title}] Circuit breaker: ${consecutiveErrorsRef.current} errors. Entering stream-down retry.`)
                  fatalErrorTypeRef.current = "stream_down"
                  hls.stopLoad()
                  hasFatalErrorRef.current = true
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
      isPausedRef.current = false
    } else {
      video.pause()
      setIsPaused(true)
      isPausedRef.current = true
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
      video.play().then(() => {
        setIsPaused(false)
        isPausedRef.current = false
      }).catch((err) => console.error("Error resuming video:", err))
    } else {
      video.pause()
      setIsPaused(true)
      isPausedRef.current = true
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

    // Guard: if a recovery interval is already running, do NOT spawn a second one.
    // hasFatalError can be set to true multiple times (stall handler re-fires while already
    // recovering), which would cause this useEffect to re-run and create duplicate intervals
    // that destroy each other's HLS instances.
    if (retryIntervalRef.current !== null) {
      console.log(`[${title}] Recovery interval already running — skipping duplicate.`)
      return
    }

    const video = videoRef.current
    if (!video) return

    // Read the error type that was recorded BEFORE hasFatalError was set.
    // This is the fix for the is403Recovery closure bug: instead of inferring
    // the error type inside the interval callback (where it was always wrong on
    // the first tick), we read it directly from a ref that was set at detection time.
    const recoveryMode = fatalErrorTypeRef.current ?? "stream_down"
    console.log(`[${title}] Entering recovery loop. Mode: ${recoveryMode}`)

    // Counts consecutive 403s seen on the new HLS instances created during recovery.
    // Shared across all interval ticks via closure — no closure bug since it's
    // a simple number, not derived from async callbacks.
    let consecutive403sInRecovery = 0

    const retryInterval = setInterval(() => {
      if (isPausedRef.current) return

      if (isPermanentlyStoppedRef.current) {
        clearInterval(retryInterval)
        retryIntervalRef.current = null
        return
      }

      recoverAttemptsRef.current += 1

      if (recoveryMode === "403") {
        // 403 path: after 6 attempts (30s), trigger dashboard soft reload.
        // A full dashboard remount resets all components and is the correct recovery.
        if (recoverAttemptsRef.current >= 6) {
          if (isAlarmMutedRef.current) {
            console.warn(`[${title}] 403: Failed after 30s. Alarm muted — resetting counter silently.`)
            recoverAttemptsRef.current = 0
          } else {
            console.warn(`[${title}] 403: Failed after 30s. Triggering dashboard soft reload.`)
            isPermanentlyStoppedRef.current = true
            clearInterval(retryInterval)
            retryIntervalRef.current = null
            if (onFatalError) onFatalError("token_expired")
            return
          }
        }
        console.log(`[${title}] 403 recovery — reinit attempt ${recoverAttemptsRef.current}/6`)
      } else {
        // Stream-down path: retry silently forever — no dashboard reload.
        // Reset counter every 6 so it doesn't overflow, but keep retrying indefinitely.
        if (recoverAttemptsRef.current >= 6) {
          console.log(`[${title}] Stream-down: still offline after 30s, continuing silent retry...`)
          recoverAttemptsRef.current = 0
          return
        }
        console.log(`[${title}] Stream-down — reinit attempt ${recoverAttemptsRef.current}`)
      }

      consecutiveErrorsRef.current = 0

      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }

      video.removeAttribute("src")
      video.load()

      const newHls = new Hls({
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
        xhrSetup: function (xhr) {
          xhr.setRequestHeader("x-monitoring-token", "monitoringtoken")
        },
      })

      hlsRef.current = newHls
      newHls.loadSource(url)
      newHls.attachMedia(video)

      // Monitor errors on the new instance during recovery.
      // 403: if we're in stream_down mode and a reinit gets a 403, it means the stream
      // came back online but its segments are forbidden — escalate to dashboard reload.
      // If already in 403 mode: count toward the give-up threshold.
      newHls.on(Hls.Events.ERROR, function (_, data) {
        const httpCode = (data.response as any)?.code
        if (httpCode === 403) {
          consecutive403sInRecovery += 1
          console.warn(`[${title}] 403 on reinit instance (${consecutive403sInRecovery}/5). ${
            consecutive403sInRecovery >= 5 ? 'Triggering dashboard reload.' : 'Next tick will retry.'
          }`)
          if (hlsRef.current === newHls) {
            newHls.stopLoad()
            newHls.destroy()
            hlsRef.current = null
          }
          if (consecutive403sInRecovery >= 5) {
            // After 5 consecutive 403s on reinit instances, the stream URL is truly broken.
            // Trigger dashboard soft reload regardless of recovery mode — this is the
            // correct fix for streams that come back online but have stale/forbidden tokens.
            isPermanentlyStoppedRef.current = true
            clearInterval(retryInterval)
            retryIntervalRef.current = null
            if (isAlarmMutedRef.current) {
              console.warn(`[${title}] 403 permanently stopped, alarm muted — no dashboard reload.`)
            } else {
              console.warn(`[${title}] Escalating to dashboard soft reload after persistent 403s during recovery.`)
              if (onFatalError) onFatalError("token_expired")
            }
          }
        }
        // Non-403: outer interval will retry on next tick
      })

      video.play().catch(err => console.log(`[${title}] Play after reinit failed:`, err))
    }, 5000)

    retryIntervalRef.current = retryInterval

    return () => {
      clearInterval(retryInterval)
      retryIntervalRef.current = null
      // Destroy the HLS instance that was created during the last interval tick.
      // Without this, the orphan HLS instance survives the component unmount (e.g.,
      // during soft reload), keeps firing error callbacks on a detached video element,
      // and blocks the fresh component from properly initializing.
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      // Reset error type so the fresh component doesn't inherit a stale classification
      fatalErrorTypeRef.current = null
    }
  }, [hasFatalError, url, title])

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
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-black/20" onClick={() => {
              setIsAlarmMuted(!isAlarmMuted)
              isAlarmMutedRef.current = !isAlarmMuted
            }}>
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
