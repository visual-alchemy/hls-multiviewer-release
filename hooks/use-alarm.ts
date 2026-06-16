"use client"

import { useState, useRef, useEffect } from "react"

export function useAlarm(showAlert: boolean) {
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)

  const toggleMute = () => {
    setIsMuted((prev) => {
      isMutedRef.current = !prev
      return !prev
    })
  }

  useEffect(() => {
    let audio: HTMLAudioElement | null = null
    if (showAlert && !isMuted) {
      audio = new Audio("/alert.mp3")
      audio.loop = true
      audio.play().catch(() => {
        // Silent catch for play interruptions (AbortError)
      })
    }
    return () => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    }
  }, [showAlert, isMuted])

  return { isMuted, isMutedRef, toggleMute }
}
