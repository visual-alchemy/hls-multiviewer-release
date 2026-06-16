"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { VideoPlayer } from "@/components/video-player"
import { AddStreamDialog } from "@/components/add-stream-dialog"
import { GridConfigDialog } from "@/components/grid-config-dialog"
import { Button } from "@/components/ui/button"
import { Maximize, Plus, Volume2, VolumeX, Download, Upload, Grid, Pause, Play } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

// Define the structure of a stream object
interface Stream {
  id: string
  title: string
  url: string
}

export default function MultiViewer() {
  // Stagger counter to delay playback start across tiles
  const [staggerSeed] = useState(() => Math.floor(Math.random() * 1000))
  // State to store the list of streams
  const [streams, setStreams] = useState<Stream[]>([])
  // State to keep track of the stream being edited
  const [editingStream, setEditingStream] = useState<Stream | null>(null)
  // State to control global mute for all streams
  const [globalMute, setGlobalMute] = useState(true)
  // Reference to the multiviewer container for fullscreen functionality
  const multiviewerRef = useRef<HTMLDivElement>(null)
  // Reference to the file input for importing streams
  const fileInputRef = useRef<HTMLInputElement>(null)
  // State to track fullscreen status
  const [isFullscreen, setIsFullscreen] = useState(false)
  // State for grid configuration
  const [gridRows, setGridRows] = useState(6)
  const [gridColumns, setGridColumns] = useState(7)
  const [isGridConfigOpen, setIsGridConfigOpen] = useState(false)
  // State for add stream dialog
  const [isAddStreamOpen, setIsAddStreamOpen] = useState(false)
  // State for import confirmation dialog
  const [pendingImport, setPendingImport] = useState<Stream[] | null>(null)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)

  // State for soft reload mechanism
  const [softReloadKey, setSoftReloadKey] = useState(0)
  const [fatalErrorCount, setFatalErrorCount] = useState(0)
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cross-stream error correlation (Tier 1.5)
  const [streamCorrelationBanner, setStreamCorrelationBanner] = useState<string | null>(null)
  const streamErrorsRef = useRef<Map<string, { type: string; time: number }>>(new Map())

  const { toast } = useToast()

  // Load streams from the API when component mounts
  useEffect(() => {
    fetchStreams()
  }, [])

  // Effect to handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Effect to trigger a HARD page reload when fatal 403 errors occur.
  // A React-level soft remount does NOT work for 403 recovery because:
  //   1. The HLS master URL itself is still valid (hdnts token = 1 year).
  //   2. But Akamai embeds short-lived HDNTL tokens inside the playlist responses.
  //   3. A soft remount reuses the same URL → browser HTTP cache serves the stale playlist
  //      with expired HDNTL tokens → 403 on segments again → infinite loop.
  // A full window.location.reload() clears the browser HTTP cache, forcing fresh
  // manifest fetches from the CDN with new HDNTL tokens — exactly like a manual F5.
  useEffect(() => {
    /* 
    DISABLED: Relying on per-panel hard reset (internalReloadCount) to recover from 403s
    instead of refreshing the entire dashboard.
    
    if (fatalErrorCount > 0 && !reloadTimerRef.current) {
      console.log(`Detected ${fatalErrorCount} stream failure(s). Triggering HARD page reload in 5s...`)

      reloadTimerRef.current = setTimeout(() => {
        console.log("Executing hard page reload to clear stale Akamai HDNTL tokens.")
        window.location.reload()
      }, 5000)
    }
    */
  }, [fatalErrorCount])

  // Load grid configuration from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem("gridConfig")
    if (savedConfig) {
      const { rows, columns } = JSON.parse(savedConfig)
      setGridRows(rows)
      setGridColumns(columns)
    }
  }, [])

  // Function to fetch streams from the API
  const fetchStreams = async () => {
    try {
      const response = await fetch("/api/streams")
      if (response.ok) {
        const data = await response.json()
        setStreams(data)
      }
    } catch (error) {
      console.error("Error fetching streams:", error)
    }
  }

  // Function to handle adding a new stream
  const handleAddStream = async (title: string, url: string) => {
    try {
      const response = await fetch("/api/streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, url }),
      })
      if (response.ok) {
        const updatedStreams = await response.json()
        setStreams(updatedStreams)
      }
    } catch (error) {
      console.error("Error adding stream:", error)
    }
    setIsAddStreamOpen(false)
  }

  // Function to set up stream editing
  const handleEditStream = (id: string) => {
    const streamToEdit = streams.find((stream) => stream.id === id)
    if (streamToEdit) {
      setEditingStream(streamToEdit)
    }
  }

  // Function to handle updating an existing stream
  const handleUpdateStream = async (id: string, title: string, url: string) => {
    try {
      const response = await fetch("/api/streams", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, title, url }),
      })
      if (response.ok) {
        const updatedStreams = await response.json()
        setStreams(updatedStreams)
      }
    } catch (error) {
      console.error("Error updating stream:", error)
    }
    setEditingStream(null)
  }

  // Function to handle deleting a stream
  const handleDeleteStream = async (id: string) => {
    try {
      const response = await fetch("/api/streams", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        const updatedStreams = await response.json()
        setStreams(updatedStreams)
      }
    } catch (error) {
      console.error("Error deleting stream:", error)
    }
  }

  // Function to toggle fullscreen mode
  const handleFullscreen = () => {
    if (!isFullscreen) {
      multiviewerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // Function to toggle global mute
  const toggleGlobalMute = () => {
    setGlobalMute((prev) => !prev)
  }

  // Global playback state
  const [isGlobalPaused, setIsGlobalPaused] = useState(false)
  const [playbackCommand, setPlaybackCommand] = useState<{ action: "play" | "pause"; id: number }>({
    action: "play",
    id: 0,
  })

  // Function to export streams
  const handleExport = () => {
    const dataStr = JSON.stringify(streams)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    const exportFileDefaultName = "streams.json"

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }

  // Function to import streams — step 1: parse file and show confirmation
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset input value so re-selecting same file still triggers onChange
    event.target.value = ""
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result
          if (typeof content === "string") {
            const importedStreams = JSON.parse(content) as Stream[]
            if (!Array.isArray(importedStreams)) {
              throw new Error("Imported data is not an array")
            }
            // Store parsed data and show confirmation before sending to API
            setPendingImport(importedStreams)
            setIsImportConfirmOpen(true)
          }
        } catch (error) {
          console.error("Error reading import file:", error)
          toast({
            title: "Invalid file",
            description: error instanceof Error ? error.message : "The selected file is not valid JSON.",
            variant: "destructive",
          })
        }
      }
      reader.onerror = () => {
        toast({
          title: "File read error",
          description: "Could not read the file. Please try again.",
          variant: "destructive",
        })
      }
      reader.readAsText(file)
    }
  }

  // Step 2: user confirmed — send to API and replace streams
  const handleImportConfirm = async () => {
    if (!pendingImport) return
    try {
      const response = await fetch("/api/streams/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingImport),
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const updatedStreams = await response.json()
      setStreams(updatedStreams)
      toast({
        title: "Streams imported",
        description: `${updatedStreams.length} stream${updatedStreams.length !== 1 ? "s" : ""} loaded successfully.`,
      })
    } catch (error) {
      console.error("Error importing streams:", error)
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      })
    } finally {
      setPendingImport(null)
      setIsImportConfirmOpen(false)
    }
  }

  // Function to handle grid configuration changes
  const handleGridConfigChange = (rows: number, columns: number) => {
    setGridRows(rows)
    setGridColumns(columns)
    localStorage.setItem("gridConfig", JSON.stringify({ rows, columns }))
  }

  const toggleGlobalPlayback = () => {
    setIsGlobalPaused((prev) => {
      const nextPaused = !prev
      setPlaybackCommand((cmd) => ({ action: nextPaused ? "pause" : "play", id: cmd.id + 1 }))
      return nextPaused
    })
  }

  // State to track if a specific stream is soloed (maximized)
  const [soloStreamId, setSoloStreamId] = useState<string | null>(null)

  const toggleSoloStream = (id: string) => {
    setSoloStreamId((prevId) => (prevId === id ? null : id))
  }

  // Handle fatal error prop from individual VideoPlayers.
  // Both "token_expired" (403, CDN blip) and "stream_down" (persistent network failure)
  // trigger the same soft reload — incrementing softReloadKey fully remounts all VideoPlayer
  // components, resetting isPermanentlyStoppedRef and all other stuck state.
  const handleFatalError = (reason: "token_expired" | "stream_down") => {
    console.log(`Fatal error signal received: ${reason}. Queuing soft reload.`)
    setFatalErrorCount((prev) => prev + 1)
  }

  // Cross-stream error correlation handler (Tier 1.5)
  const handleStreamStatus = useCallback((status: { type: string; title: string }) => {
    streamErrorsRef.current.set(status.title, { type: status.type, time: Date.now() })
  }, [])

  // Periodic check for cross-stream error patterns
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const errors = streamErrorsRef.current
      const activeStreams = streams.length
      if (activeStreams === 0) {
        setStreamCorrelationBanner(null)
        return
      }

      const typeCounts: Record<string, number> = {}
      for (const [, entry] of errors) {
        if (now - entry.time < 30000) {
          typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1
        }
      }

      for (const [type, count] of Object.entries(typeCounts)) {
        if (count > activeStreams * 0.5) {
          const label =
            type === "http_502" ? "Proxy unreachable (502)" :
            type === "http_403" ? "CDN tokens expiring (403)" :
            `${type} on ${count}/${activeStreams} streams`
          setStreamCorrelationBanner(label)
          return
        }
      }
      setStreamCorrelationBanner(null)
    }, 10000)

    return () => clearInterval(interval)
  }, [streams.length])

  return (
    <div className={`h-screen bg-[#1a1b26] flex flex-col ${isFullscreen ? "p-0" : "p-4"}`} ref={multiviewerRef}>
      {/* Header with logo and title */}
      <div className={`flex items-center shrink-0 mb-4 ${isFullscreen || soloStreamId ? "hidden" : ""}`}>
        <div className="flex items-center">
          <Image
            src="https://i.ibb.co.com/tT7cmrcv/Logo-Vidio-Apps.png"
            alt="Vidio Logo"
            width={32}
            height={32}
            className="mr-2"
          />
          <h1 className="text-white text-xl font-semibold">Vidio HLS Multiviewer</h1>
        </div>
        {/* Control buttons */}
        <div className="flex ml-auto gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: "none" }} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Upload className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} className="bg-gray-800 hover:bg-gray-700">
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsAddStreamOpen(true)}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsGridConfigOpen(true)}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Grid className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleGlobalPlayback} className="bg-gray-800 hover:bg-gray-700">
            {isGlobalPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleGlobalMute} className="bg-gray-800 hover:bg-gray-700">
            {globalMute ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFullscreen} className="bg-gray-800 hover:bg-gray-700">
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Cross-stream error correlation banner (Tier 1.5) */}
      {streamCorrelationBanner && !soloStreamId && (
        <div className="bg-yellow-600/80 text-white text-sm px-4 py-2 rounded-t-lg flex items-center justify-between shrink-0 mb-2">
          <span>⚠ {streamCorrelationBanner}</span>
          <Button variant="ghost" size="sm" className="h-6 text-white hover:bg-yellow-700 ml-4" onClick={() => setStreamCorrelationBanner(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Grid of video players */}
      <div
        className={
          soloStreamId
            ? "flex-grow min-h-0 w-full h-full relative" // min-h-0 critical for flex
            : `grid w-full flex-grow min-h-0 gap-2 overflow-hidden ${isFullscreen ? "h-screen p-2" : ""}`
        }
        style={
          soloStreamId
            ? undefined
            : {
                gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
              }
        }
      >
        {Array.from({ length: gridRows * gridColumns }).map((_, index) => {
          const stream = streams[index]

          if (soloStreamId && stream?.id !== soloStreamId) {
            // Unmount hidden streams to save bandwidth and CPU when soloing another stream
            return null
          }

          return (
            <div
              key={`${stream ? stream.id : index}-${softReloadKey}`}
              className={
                soloStreamId
                  ? "w-full h-full absolute inset-0" // Solo mode container overrides
                  : "w-full h-full min-h-0" // Removing aspect-video to fit perfectly into any screen
              }
            >
              {stream ? (() => {
                const PROXY_BASE_URL = "http://192.168.40.54"
                const baseUrl = stream.url.startsWith("/") ? `${PROXY_BASE_URL}${stream.url}` : stream.url
                const finalUrl = softReloadKey > 0 ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}softReload=${softReloadKey}` : baseUrl

                return (
                <VideoPlayer
                  title={stream.title}
                  url={finalUrl}
                  onEdit={() => handleEditStream(stream.id)}
                  onDelete={() => handleDeleteStream(stream.id)}
                  onSolo={() => toggleSoloStream(stream.id)}
                  isMuted={globalMute}
                  isFullscreen={isFullscreen || !!soloStreamId}
                  isSoloed={soloStreamId === stream.id}
                  playbackCommand={playbackCommand}
                  startDelayMs={staggerSeed + index * 300}
                  onFatalError={handleFatalError}
                  onStreamStatus={handleStreamStatus}
                />
                )
              })() : (
                <div className="w-full h-full rounded-lg bg-[#1f2937] flex items-center justify-center">
                  <p className="text-gray-400">No Stream</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Fullscreen controls */}
      {isFullscreen && !soloStreamId && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleGlobalMute}
            className="bg-gray-800/50 hover:bg-gray-700/50"
          >
            {globalMute ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="bg-gray-800/50 hover:bg-gray-700/50"
          >
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Add stream dialog */}
      <AddStreamDialog isOpen={isAddStreamOpen} onAdd={handleAddStream} onClose={() => setIsAddStreamOpen(false)} />

      {/* Edit stream dialog */}
      {editingStream && (
        <AddStreamDialog
          isOpen={true}
          onAdd={(title, url) => handleUpdateStream(editingStream.id, title, url)}
          onClose={() => setEditingStream(null)}
          initialTitle={editingStream.title}
          initialUrl={editingStream.url}
        />
      )}

      {/* Grid configuration dialog */}
      <GridConfigDialog
        isOpen={isGridConfigOpen}
        onClose={() => setIsGridConfigOpen(false)}
        onConfigChange={handleGridConfigChange}
        initialRows={gridRows}
        initialColumns={gridColumns}
      />

      {/* Import confirmation dialog */}
      <AlertDialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current streams?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {streams.length} current stream{streams.length !== 1 ? "s" : ""} with{" "}
              <strong>{pendingImport?.length ?? 0} stream{(pendingImport?.length ?? 0) !== 1 ? "s" : ""}</strong> from the imported file.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingImport(null); setIsImportConfirmOpen(false) }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleImportConfirm}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
