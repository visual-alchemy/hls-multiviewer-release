"use client"

import { useEffect, useRef, useCallback } from "react"

interface FrameAnalyzerCallbacks {
  /** Called when 3+ consecutive identical frames are detected while timecode advances */
  onFreeze: () => void
  /** Called when average luminance stays below threshold for the configured duration */
  onBlack: () => void
  /** Called when black state clears (luminance rises above threshold) */
  onBlackCleared: () => void
}

interface FrameAnalyzerOptions {
  /** Master switch — parent controls when analysis is active */
  enabled: boolean
  /** Milliseconds between frame samples (default 2000) */
  intervalMs?: number
  /** How many consecutive identical frames before triggering freeze (default 3) */
  freezeThreshold?: number
  /** Luminance threshold 0-1, below which a frame is considered black (default 0.02) */
  blackThreshold?: number
  /** Milliseconds of continuous black frames before triggering alert (default 10000) */
  blackDurationMs?: number
}

const CANVAS_WIDTH = 64
const CANVAS_HEIGHT = 36
const PIXEL_SAMPLE_RATE = 10 // compare every 10th pixel for freeze detection

function framesAreIdentical(a: ImageData, b: ImageData): boolean {
  const dataA = a.data
  const dataB = b.data
  for (let i = 0; i < dataA.length; i += 4 * PIXEL_SAMPLE_RATE) {
    if (dataA[i] !== dataB[i] || dataA[i + 1] !== dataB[i + 1] || dataA[i + 2] !== dataB[i + 2]) {
      return false
    }
  }
  return true
}

function computeAverageLuminance(imageData: ImageData): number {
  const data = imageData.data
  let sum = 0
  const pixelCount = imageData.width * imageData.height
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return sum / pixelCount / 255
}

export function useFrameAnalyzer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: FrameAnalyzerOptions,
  callbacks: FrameAnalyzerCallbacks,
) {
  const {
    enabled,
    intervalMs = 2000,
    freezeThreshold = 3,
    blackThreshold = 0.02,
    blackDurationMs = 10000,
  } = options

  const lastFrameRef = useRef<ImageData | null>(null)
  const freezeCountRef = useRef(0)
  const blackStartTimeRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasBlackRef = useRef(false)
  const taintedRef = useRef(false)

  // Stable callback refs to avoid re-creating the interval
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const freezeThresholdRef = useRef(freezeThreshold)
  freezeThresholdRef.current = freezeThreshold
  const blackThresholdRef = useRef(blackThreshold)
  blackThresholdRef.current = blackThreshold
  const blackDurationMsRef = useRef(blackDurationMs)
  blackDurationMsRef.current = blackDurationMs

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas")
      canvasRef.current.width = CANVAS_WIDTH
      canvasRef.current.height = CANVAS_HEIGHT
      ctxRef.current = canvasRef.current.getContext("2d", { willReadFrequently: true })
    }

    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!ctx) return

    try {
      ctx.drawImage(video, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      if (!taintedRef.current) {
        console.warn("[FrameAnalyzer] Canvas tainted — video may be cross-origin without CORS headers")
        taintedRef.current = true
      }
      return
    }

    let imageData: ImageData
    try {
      imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    } catch {
      if (!taintedRef.current) {
        console.warn("[FrameAnalyzer] Cannot read pixel data — canvas tainted")
        taintedRef.current = true
      }
      return
    }

    // Compute luminance first — black frames are naturally identical
    // and should NOT count toward visual freeze detection.
    const luminance = computeAverageLuminance(imageData)

    // Freeze detection: compare with previous frame
    if (luminance < blackThresholdRef.current) {
      // Frame is near-black — reset freeze counter, let black detector handle this
      freezeCountRef.current = 0
      lastFrameRef.current = imageData
    } else if (lastFrameRef.current && framesAreIdentical(lastFrameRef.current, imageData)) {
      freezeCountRef.current += 1
      if (freezeCountRef.current >= freezeThresholdRef.current) {
        // Verify currentTime is advancing — if not, the built-in stall handler catches it
        if (video.currentTime > 0 && !video.paused) {
          callbacksRef.current.onFreeze()
          // Don't reset freezeCount — we stay frozen until frames change
        }
      }
    } else {
      freezeCountRef.current = 0
    }
    lastFrameRef.current = imageData

    // Black frame detection
    if (luminance < blackThresholdRef.current) {
      if (blackStartTimeRef.current === null) {
        blackStartTimeRef.current = Date.now()
      }
      if (!wasBlackRef.current && Date.now() - blackStartTimeRef.current >= blackDurationMsRef.current) {
        wasBlackRef.current = true
        callbacksRef.current.onBlack()
      }
    } else {
      if (wasBlackRef.current) {
        wasBlackRef.current = false
        callbacksRef.current.onBlackCleared()
      }
      blackStartTimeRef.current = null
    }
  }, [videoRef])

  useEffect(() => {
    if (!enabled) {
      // Reset state when disabled
      lastFrameRef.current = null
      freezeCountRef.current = 0
      blackStartTimeRef.current = null
      wasBlackRef.current = false
      return
    }

    // Fire first analysis after a short delay so the video has content
    const initialTimer = setTimeout(analyzeFrame, 1000)

    const interval = setInterval(analyzeFrame, intervalMs)
    intervalRef.current = interval

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      intervalRef.current = null
    }
  }, [enabled, intervalMs, analyzeFrame])

  // Cleanup canvas on unmount
  useEffect(() => {
    return () => {
      canvasRef.current = null
      ctxRef.current = null
    }
  }, [])
}
