"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { VideoPlayer } from "@/components/video-player"
import { AddStreamDialog } from "@/components/add-stream-dialog"
import { Button } from "@/components/ui/button"
import { Maximize, Plus, Volume2, VolumeX, Download, Upload } from "lucide-react"

// Define the structure of a stream object
interface Stream {
  id: string
  title: string
  url: string
}

export default function MultiViewer() {
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

  // Load streams from the API when component mounts
  useEffect(() => {
    fetchStreams()
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
    if (multiviewerRef.current) {
      if (!document.fullscreenElement) {
        multiviewerRef.current.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  }

  // Function to toggle global mute
  const toggleGlobalMute = () => {
    setGlobalMute((prev) => !prev)
  }

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
            const response = await fetch("/api/streams/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(importedStreams),
            })
            if (response.ok) {
              const updatedStreams = await response.json()
              setStreams(updatedStreams)
            }
          }
        } catch (error) {
          console.error("Error importing streams:", error)
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] p-4">
      {/* Header with logo and title */}
      <div className="flex items-center mb-6">
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
          <AddStreamDialog
            onAdd={handleAddStream}
            trigger={
              <Button variant="ghost" size="icon" className="bg-gray-800 hover:bg-gray-700">
                <Plus className="h-5 w-5" />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" onClick={toggleGlobalMute} className="bg-gray-800 hover:bg-gray-700">
            {globalMute ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFullscreen} className="bg-gray-800 hover:bg-gray-700">
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Grid of video players */}
      <div ref={multiviewerRef} className="grid grid-cols-6 gap-4">
        {Array.from({ length: 42 }).map((_, index) => {
          const stream = streams[index]
          return (
            <div key={index} className="aspect-video">
              {stream ? (
                <VideoPlayer
                  title={stream.title}
                  url={stream.url}
                  onEdit={() => handleEditStream(stream.id)}
                  onDelete={() => handleDeleteStream(stream.id)}
                  isMuted={globalMute}
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
    </div>
  )
}

