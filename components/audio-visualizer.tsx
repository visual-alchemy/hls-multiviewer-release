"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"

interface AudioVisualizerProps {
  videoRef: React.RefObject<HTMLVideoElement>
}

export function AudioVisualizer({ videoRef }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const analyserRef = useRef<AnalyserNode>()
  const audioContextRef = useRef<AudioContext>()
  const sourceRef = useRef<MediaElementAudioSourceNode>()
  const [isContextActive, setIsContextActive] = useState(false)

  // Initialize AudioContext on user interaction
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const initializeAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
          setIsContextActive(true)
        } catch (error) {
          console.error("Failed to create AudioContext:", error)
        }
      } else if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume()
      }
    }

    // Initialize on play and unmute
    video.addEventListener("play", initializeAudioContext)
    video.addEventListener("volumechange", initializeAudioContext)

    return () => {
      video.removeEventListener("play", initializeAudioContext)
      video.removeEventListener("volumechange", initializeAudioContext)
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close()
        setIsContextActive(false)
      }
    }
  }, [videoRef])

  // Handle audio visualization
  useEffect(() => {
    const video = videoRef.current
    if (!video || !canvasRef.current || !isContextActive || !audioContextRef.current) return

    const setupAudioNodes = () => {
      if (!audioContextRef.current || !video) return

      try {
        // Only create new source if needed
        if (!sourceRef.current) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(video)
        }

        const analyser = audioContextRef.current.createAnalyser()
        analyserRef.current = analyser

        sourceRef.current.connect(analyser)
        analyser.connect(audioContextRef.current.destination)

        analyser.fftSize = 32
        return analyser
      } catch (error) {
        console.error("Error setting up audio nodes:", error)
        return null
      }
    }

    const analyser = setupAudioNodes()
    if (!analyser) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (audioContextRef.current?.state === "closed") return

      const WIDTH = canvas.width
      const HEIGHT = canvas.height

      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, WIDTH, HEIGHT)

      // Draw left channel (first bar)
      const barWidth = 4
      const gap = 2
      const leftValue = dataArray[0]
      const leftHeight = (leftValue / 255) * (HEIGHT - 12) // Adjusted for label space
      ctx.fillStyle = `rgb(0, 255, 0)`
      ctx.fillRect(0, HEIGHT - 12 - leftHeight, barWidth, leftHeight)

      // Draw right channel (second bar)
      const rightValue = dataArray[1]
      const rightHeight = (rightValue / 255) * (HEIGHT - 12)
      ctx.fillRect(barWidth + gap, HEIGHT - 12 - rightHeight, barWidth, rightHeight)

      // Draw channel labels with relative font size
      ctx.fillStyle = "white"
      const fontSize = Math.max(6, HEIGHT * 0.06) // Responsive font size
      ctx.font = `${fontSize}px Arial`
      ctx.fillText("L", 0, HEIGHT - 2)
      ctx.fillText("R", barWidth + gap, HEIGHT - 2)

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
      }
    }
  }, [videoRef, isContextActive])

  // Final cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect()
      }
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close()
      }
    }
  }, [])

  return (
    <div className="h-full w-[10px]">
      <canvas ref={canvasRef} width={10} height={100} className="h-full w-full opacity-80" />
    </div>
  )
}

