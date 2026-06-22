"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

interface LogViewerDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function LogViewerDialog({ isOpen, onClose }: LogViewerDialogProps) {
  const [logs, setLogs] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs")
      if (res.ok) {
        const data = await res.json()
        setLogs(data.content || "")
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      fetchLogs().finally(() => setIsLoading(false))

      // Poll every 4 seconds to pull fresh stream events
      const interval = setInterval(fetchLogs, 4000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  // Auto-scroll to bottom when logs are updated
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  const handleExport = () => {
    window.open("/api/logs?download=true", "_blank")
  }

  // Parse lines to add color coding dynamically
  const renderLogLines = () => {
    if (!logs) return <div className="text-gray-500 italic">No log entries found.</div>

    const lines = logs.split("\n")
    return lines.map((line, idx) => {
      if (!line.trim()) return null

      // Check keywords for dynamic highlighting
      let colorClass = "text-gray-300"
      if (line.includes("[ERROR]") || line.includes("FATAL") || line.includes("FAIL")) {
        colorClass = "text-red-400 font-medium"
      } else if (line.includes("[WARN]") || line.includes("STALLED") || line.includes("BLACK")) {
        colorClass = "text-amber-400 font-medium"
      } else if (line.includes("PLAYING") || line.includes("RECOVERED") || line.includes("OK")) {
        colorClass = "text-emerald-400"
      } else if (line.includes("RECOVERING") || line.includes("RECOVER_ATTEMPT")) {
        colorClass = "text-sky-400"
      } else if (line.includes("=== HLS")) {
        colorClass = "text-violet-400 font-bold tracking-wide border-b border-violet-900/50 pb-1 mb-2 block"
      }

      return (
        <div key={idx} className={`${colorClass} hover:bg-white/5 px-2 py-0.5 rounded transition-colors`}>
          {line}
        </div>
      )
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-[#13141f]/95 border-gray-800 text-white flex flex-col h-[75vh] backdrop-blur-xl shadow-2xl rounded-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>📄 System Activity Log</span>
            </DialogTitle>
            <p className="text-xs text-gray-400 mt-1">Real-time stream state transitions, warnings, and recovery actions.</p>
          </div>
          
          {/* Live pulsing indicator */}
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-1 rounded-full text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live feed
          </div>
        </DialogHeader>

        {/* Scrollable logs box */}
        <div
          ref={logContainerRef}
          className="flex-grow overflow-y-auto bg-gray-950/80 p-4 rounded-lg font-mono text-[11px] leading-relaxed border border-gray-900 shadow-inner select-text scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
              </span>
              <span>Loading today's system logs...</span>
            </div>
          ) : (
            <div className="space-y-0.5">{renderLogLines()}</div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
          <Button
            onClick={handleExport}
            className="bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs px-4 py-2 flex items-center gap-2 rounded-lg transition-all active:scale-95 shadow-md shadow-violet-900/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Log File</span>
          </Button>
          <Button
            onClick={onClose}
            className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-900/50 font-medium text-xs px-4 py-2 flex items-center gap-1.5 rounded-lg transition-all active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
