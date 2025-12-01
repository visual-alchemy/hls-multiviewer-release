"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { VideoPlayer } from "@/components/video-player"
import { AddStreamDialog } from "@/components/add-stream-dialog"
import { GridConfigDialog } from "@/components/grid-config-dialog"
import { Button } from "@/components/ui/button"
import { Maximize, Plus, Volume2, VolumeX, Download, Upload, Grid, Pause, Play } from "lucide-react"

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

  // Function to import streams
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const content = e.target?.result
          if (typeof content === "string") {
            const importedStreams = JSON.parse(content) as Stream[]
            if (!Array.isArray(importedStreams)) {
              throw new Error("Imported data is not an array")
            }
            const response = await fetch("/api/streams/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(importedStreams),
            })
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`)
            }
            const updatedStreams = await response.json()
            setStreams(updatedStreams)
          }
        } catch (error) {
          console.error("Error importing streams:", error)
          // You might want to show this error to the user in the UI
          alert(`Error importing streams: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      reader.onerror = (error) => {
        console.error("FileReader error:", error)
        alert("Error reading file. Please try again.")
      }
      reader.readAsText(file)
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

  return (
    <div className={`min-h-screen bg-[#1a1b26] ${isFullscreen ? "p-0" : "p-4"}`} ref={multiviewerRef}>
      {/* Header with logo and title */}
      <div className={`flex items-center mb-6 ${isFullscreen ? "hidden" : ""}`}>
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
        className={`grid gap-2 w-full ${isFullscreen ? "h-screen auto-rows-fr overflow-auto p-2" : "gap-4"}`}
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: gridRows * gridColumns }).map((_, index) => {
          const stream = streams[index]
          return (
            <div key={index} className={`${isFullscreen ? "w-full h-full min-h-0" : "aspect-video"}`}>
              {stream ? (
                <VideoPlayer
                  title={stream.title}
                  url={stream.url}
                  onEdit={() => handleEditStream(stream.id)}
                  onDelete={() => handleDeleteStream(stream.id)}
                  isMuted={globalMute}
                  isFullscreen={isFullscreen}
                  playbackCommand={playbackCommand}
                  startDelayMs={staggerSeed + index * 300}
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
      {isFullscreen && (
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
    </div>
  )
}
