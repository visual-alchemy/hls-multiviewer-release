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
const SILENCE_DURATION_MS = 3000

export function AudioVisualizer({ videoRef, isMuted, onSilenceChange }: AudioVisualizerProps) {
  // Reference to the canvas element
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Reference to the animation frame
  const animationRef = useRef<number>()
  // Reference to the audio analyser
  const analyserRef = useRef<AnalyserNode>()
  // Reference to the audio context
  const audioContextRef = useRef<AudioContext>()
  // Reference to the audio source
  const sourceRef = useRef<MediaElementAudioSourceNode>()
  // Reference to the gain node controlling audible output
  const gainNodeRef = useRef<GainNode>()
  // Track silence timing
  const silenceStartRef = useRef<number | null>(null)
  const lastSilenceStateRef = useRef(false)

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
          analyserRef.current = audioContextRef.current.createAnalyser()
          gainNodeRef.current = audioContextRef.current.createGain()
          analyserRef.current.fftSize = 32
          sourceRef.current.connect(analyserRef.current)
          analyserRef.current.connect(gainNodeRef.current)
          gainNodeRef.current.connect(audioContextRef.current.destination)
          gainNodeRef.current.gain.value = isMuted ? 0 : 1
        } catch (error) {
          console.error("Error setting up audio nodes:", error)
          return
        }
      }

      const analyser = analyserRef.current
      const ctx = canvas.getContext("2d")
      if (!analyser || !ctx) return

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        if (!analyserRef.current || audioContextRef.current?.state === "closed") return

        analyserRef.current.getByteFrequencyData(dataArray)

        const WIDTH = canvas.width
        const HEIGHT = canvas.height
        ctx.clearRect(0, 0, WIDTH, HEIGHT)

        const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT - 12)
        gradient.addColorStop(0, "red")
        gradient.addColorStop(0.5, "yellow")
        gradient.addColorStop(1, "green")

        const barWidth = 6
        const gap = 2
        const leftValue = dataArray[0]
        const leftHeight = (leftValue / 255) * (HEIGHT - 12)
        ctx.fillStyle = gradient
        ctx.fillRect(0, HEIGHT - 12 - leftHeight, barWidth, leftHeight)

        const rightValue = dataArray[1]
        const rightHeight = (rightValue / 255) * (HEIGHT - 12)
        ctx.fillRect(barWidth + gap, HEIGHT - 12 - rightHeight, barWidth, rightHeight)

        ctx.fillStyle = "white"
        const fontSize = Math.max(6, HEIGHT * 0.06)
        ctx.font = `${fontSize}px Arial`
        ctx.fillText("L", 0, HEIGHT - 2)
        ctx.fillText("R", barWidth + gap, HEIGHT - 2)

        // Silence detection – average the spectrum and track duration
        const avg =
          dataArray.reduce((sum, value) => sum + value, 0) / (bufferLength || 1)
        const normalized = avg / 255
        const videoElement = videoRef.current
        const now = performance.now()
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
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = undefined
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
        analyserRef.current = undefined
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
