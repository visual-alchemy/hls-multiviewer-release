"use client"

import { useEffect, useRef } from "react"
import type React from "react"

// Define the props for the AudioVisualizer component
interface AudioVisualizerProps {
  videoRef: React.RefObject<HTMLVideoElement>
  isMuted: boolean
  onSilenceChange?: (isSilent: boolean) => void
}

const SILENCE_THRESHOLD = 0.01
const SILENCE_DURATION_MS = 10000
const SEGMENT_COUNT = 20
const FRAME_INTERVAL_MS = 33 // ~30 FPS

export function AudioVisualizer({ videoRef, isMuted, onSilenceChange }: AudioVisualizerProps) {
  // Reference to the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Reference to the animation frame
  const animationRef = useRef<number>()
  // References to the audio analysers
  const leftAnalyserRef = useRef<AnalyserNode>()
  const rightAnalyserRef = useRef<AnalyserNode>()
  // Reference to the audio context
  const audioContextRef = useRef<AudioContext>()
  // Reference to the audio source
  const sourceRef = useRef<MediaElementAudioSourceNode>()
  // Reference to the channel splitter
  const splitterRef = useRef<ChannelSplitterNode>()
  // Reference to the gain node controlling audible output
  const gainNodeRef = useRef<GainNode>()
  // Track silence timing
  const silenceStartRef = useRef<number | null>(null)
  const lastSilenceStateRef = useRef(false)
  const lastFrameTimeRef = useRef(0)

  const reportSilenceChange = (isSilent: boolean) => {
    if (lastSilenceStateRef.current !== isSilent) {
      lastSilenceStateRef.current = isSilent
      onSilenceChange?.(isSilent)
    }
  }
  // Effect to handle audio visualization
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const initializeAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch (error) {
          console.error("Failed to create AudioContext:", error)
          return
        }
      }

      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }

      if (!sourceRef.current) {
        try {
          sourceRef.current = audioContextRef.current.createMediaElementSource(video)
          const splitter = audioContextRef.current.createChannelSplitter(2)
          splitterRef.current = splitter
          const leftAnalyser = audioContextRef.current.createAnalyser()
          const rightAnalyser = audioContextRef.current.createAnalyser()
          gainNodeRef.current = audioContextRef.current.createGain()
          leftAnalyser.fftSize = 32
          rightAnalyser.fftSize = 32
          sourceRef.current.connect(splitter)
          splitter.connect(leftAnalyser, 0)
          splitter.connect(rightAnalyser, 1)
          sourceRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          gainNodeRef.current.gain.value = isMuted ? 0 : 1
          leftAnalyserRef.current = leftAnalyser
          rightAnalyserRef.current = rightAnalyser
        } catch (error) {
          console.error("Error setting up audio nodes:", error)
          return
        }
      }

      const leftAnalyser = leftAnalyserRef.current
      const rightAnalyser = rightAnalyserRef.current
      const ctx = canvas.getContext("2d")
      if (!leftAnalyser || !rightAnalyser || !ctx) return

      const bufferLength = leftAnalyser.frequencyBinCount
      const leftData = new Uint8Array(bufferLength)
      const rightData = new Uint8Array(bufferLength)

      const draw = () => {
        if (!leftAnalyserRef.current || !rightAnalyserRef.current || audioContextRef.current?.state === "closed") return

        const now = performance.now()
        if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) {
          animationRef.current = requestAnimationFrame(draw)
          return
        }
        lastFrameTimeRef.current = now

        leftAnalyserRef.current.getByteFrequencyData(leftData)
        rightAnalyserRef.current.getByteFrequencyData(rightData)

        const WIDTH = canvas.width
        const HEIGHT = canvas.height
        ctx.clearRect(0, 0, WIDTH, HEIGHT)

        const leftAvg = leftData.reduce((s, v) => s + v, 0) / (bufferLength || 1)
        const rightAvg = rightData.reduce((s, v) => s + v, 0) / (bufferLength || 1)
        const avg = (leftAvg + rightAvg) / 2
        const toSegments = (value: number) =>
          Math.max(0, Math.min(SEGMENT_COUNT, Math.round((value / 255) * SEGMENT_COUNT)))
        const leftSegments = toSegments(leftAvg)
        const rightSegments = toSegments(rightAvg)

        const segmentGap = 2
        const labelHeight = 18
        const totalGap = segmentGap * (SEGMENT_COUNT - 1)
        const availableHeight = HEIGHT - totalGap - labelHeight
        const segmentHeight = availableHeight / SEGMENT_COUNT
        const channelGap = 4
        const channelWidth = (WIDTH - channelGap) / 2
        const baseY = HEIGHT - labelHeight

        const drawChannel = (startX: number, activeSegments: number) => {
          for (let i = 0; i < SEGMENT_COUNT; i++) {
            const segmentIndex = i + 1 // 1 at bottom
            const isActive = segmentIndex <= activeSegments
            let baseColor = "#22c55e" // green
            if (segmentIndex > 15) {
              baseColor = "#ef4444" // red
            } else if (segmentIndex > 10) {
              baseColor = "#eab308" // yellow
            }

            ctx.fillStyle = isActive ? baseColor : `${baseColor}33`
            const y = baseY - segmentHeight - i * (segmentHeight + segmentGap)
            ctx.fillRect(startX, y, channelWidth, segmentHeight)
          }
        }

        drawChannel(0, leftSegments)
        drawChannel(channelWidth + channelGap, rightSegments)

        const outlineTop = baseY - (availableHeight + totalGap)
        const outlineHeight = availableHeight + totalGap
        const outlineWidth = channelWidth
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1
        ctx.strokeRect(0.5, outlineTop + 0.5, outlineWidth - 1, outlineHeight - 1)
        ctx.strokeRect(channelWidth + channelGap + 0.5, outlineTop + 0.5, outlineWidth - 1, outlineHeight - 1)

        const labelFontSize = Math.max(6, labelHeight - 10)
        ctx.fillStyle = "#ffffff"
        ctx.font = `${labelFontSize}px Arial`
        ctx.textAlign = "center"
        ctx.textBaseline = "bottom"
        ctx.fillText("L", channelWidth / 2, HEIGHT)
        ctx.fillText("R", channelWidth + channelGap + channelWidth / 2, HEIGHT)

        // Silence detection – average the spectrum and track duration
        const normalized = avg / 255
        const videoElement = videoRef.current
        const audioActive = videoElement && !videoElement.paused && videoElement.readyState >= 2
        if (audioActive && normalized < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = now
          } else if (now - silenceStartRef.current >= SILENCE_DURATION_MS) {
            reportSilenceChange(true)
          }
        } else {
          silenceStartRef.current = null
          reportSilenceChange(false)
        }

        animationRef.current = requestAnimationFrame(draw)
      }

      draw()
    }

    video.addEventListener("play", initializeAudioContext)
    video.addEventListener("volumechange", initializeAudioContext)

    return () => {
      video.removeEventListener("play", initializeAudioContext)
      video.removeEventListener("volumechange", initializeAudioContext)

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = undefined
      }
      if (splitterRef.current) {
        splitterRef.current.disconnect()
        splitterRef.current = undefined
      }
      if (leftAnalyserRef.current) {
        leftAnalyserRef.current.disconnect()
        leftAnalyserRef.current = undefined
      }
      if (rightAnalyserRef.current) {
        rightAnalyserRef.current.disconnect()
        rightAnalyserRef.current = undefined
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = undefined
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
        audioContextRef.current = undefined
      }
      silenceStartRef.current = null
      reportSilenceChange(false)
    }
  }, [videoRef, onSilenceChange])

  useEffect(() => {
    if (!gainNodeRef.current || !audioContextRef.current) return
    const gain = gainNodeRef.current
    const context = audioContextRef.current
    const value = isMuted ? 0 : 1
    gain.gain.setTargetAtTime(value, context.currentTime, 0.01)
  }, [isMuted])

  return (
    <div className="h-full w-[20px]">
      <canvas ref={canvasRef} width={20} height={100} className="h-full w-full opacity-80" />
    </div>
  )
}
