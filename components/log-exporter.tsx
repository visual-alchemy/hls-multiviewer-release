"use client"

import { useEffect } from "react"
import { getLogs } from "@/lib/logger"

export function LogExporter() {
  useEffect(() => {
    ;(window as Record<string, unknown>).__multiviewer_logs = getLogs
  }, [])
  return null
}
