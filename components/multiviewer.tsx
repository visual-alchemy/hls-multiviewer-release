"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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
  const [tokenExpiredCount, setTokenExpiredCount] = useState(0)
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null)
  const tokenRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // Effect to trigger soft reload when fatal errors occur
  // Uses a ref so the timer is never interrupted by other state changes
  useEffect(() => {
    if (fatalErrorCount > 0 && !reloadTimerRef.current) {
      console.log(`Detected stream_down failures (${fatalErrorCount}). Triggering cache-bust soft reload in 10s...`)
      
      reloadTimerRef.current = setTimeout(() => {
        console.log("Executing soft reload: rebuilding streams to bypass CDN cache.")
        setSoftReloadKey((prev) => prev + 1)
        setFatalErrorCount(0)
        reloadTimerRef.current = null
      }, 10000)
    }
  }, [fatalErrorCount])

  // Effect to re-fetch fresh stream URLs when token_expired is signalled
  // Debounced: waits 3s to batch multiple simultaneous token_expired signals
  useEffect(() => {
    if (tokenExpiredCount > 0 && !tokenRefreshTimerRef.current) {
      console.log(`Detected token_expired signals (${tokenExpiredCount}). Re-fetching fresh stream URLs in 3s...`)

      tokenRefreshTimerRef.current = setTimeout(async () => {
        console.log("Re-fetching stream list to get fresh tokens from the API...")
        await fetchStreams()
        setTokenExpiredCount(0)
        tokenRefreshTimerRef.current = null
        console.log("Stream list refreshed with new tokens.")
      }, 3000)
    }
  }, [tokenExpiredCount])

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

  // Handle fatal error prop from individual VideoPlayers
  const handleFatalError = (reason: "token_expired" | "stream_down") => {
    if (reason === "token_expired") {
      console.log(`Token expired signal received. Queuing URL refresh.`)
      setTokenExpiredCount((prev) => prev + 1)
    } else {
      setFatalErrorCount((prev) => prev + 1)
    }
  }

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
              {stream ? (
                <VideoPlayer
                  title={stream.title}
                  url={softReloadKey > 0 ? `${stream.url}${stream.url.includes("?") ? "&" : "?"}softReload=${softReloadKey}` : stream.url}
                  onEdit={() => handleEditStream(stream.id)}
                  onDelete={() => handleDeleteStream(stream.id)}
                  onSolo={() => toggleSoloStream(stream.id)}
                  isMuted={globalMute}
                  isFullscreen={isFullscreen || !!soloStreamId}
                  isSoloed={soloStreamId === stream.id}
                  playbackCommand={playbackCommand}
                  startDelayMs={staggerSeed + index * 300}
                  onFatalError={handleFatalError}
                />
              ) : (
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
