"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"

// Define the props for the AudioVisualizer component
interface AudioVisualizerProps {
  videoRef: React.RefObject<HTMLVideoElement>
}

export function AudioVisualizer({ videoRef }: AudioVisualizerProps) {
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
  // State to track if the audio context is active
  const [isContextActive, setIsContextActive] = useState(false)

  // Effect to initialize the AudioContext on user interaction
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

  // Effect to handle audio visualization
  useEffect(() => {
    const video = videoRef.current
    if (!video || !canvasRef.current || !isContextActive || !audioContextRef.current) return

    // Set up audio nodes
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

    // Draw function for the audio visualizer
    const draw = () => {
      if (audioContextRef.current?.state === "closed") return

      const WIDTH = canvas.width
      const HEIGHT = canvas.height

      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, WIDTH, HEIGHT)

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT - 12)
      gradient.addColorStop(0, "red")
      gradient.addColorStop(0.5, "yellow")
      gradient.addColorStop(1, "green")

      // Draw left channel (first bar)
      const barWidth = 6
      const gap = 2
      const leftValue = dataArray[0]
      const leftHeight = (leftValue / 255) * (HEIGHT - 12) // Adjusted for label space
      ctx.fillStyle = gradient
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

  // Effect for final cleanup
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
    <div className="h-full w-[20px]">
      <canvas ref={canvasRef} width={20} height={100} className="h-full w-full opacity-80" />
    </div>
  )
}

