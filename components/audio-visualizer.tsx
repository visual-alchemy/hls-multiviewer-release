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
          analyserRef.current.fftSize = 32
          sourceRef.current.connect(analyserRef.current)
          analyserRef.current.connect(audioContextRef.current.destination)
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
      if (analyserRef.current) {
        analyserRef.current.disconnect()
        analyserRef.current = undefined
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
        audioContextRef.current = undefined
      }
    }
  }, [videoRef])

  return (
    <div className="h-full w-[20px]">
      <canvas ref={canvasRef} width={20} height={100} className="h-full w-full opacity-80" />
    </div>
  )
}
