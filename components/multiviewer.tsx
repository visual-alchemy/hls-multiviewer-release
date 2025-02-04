"use client"

import { useState, useRef, useEffect } from "react"
import { VideoPlayer } from "@/components/video-player"
import { AddStreamDialog } from "@/components/add-stream-dialog"
import { Button } from "@/components/ui/button"
import { Maximize, Plus, Volume2, VolumeX } from "lucide-react"

interface Stream {
  id: string
  title: string
  url: string
}

export default function MultiViewer() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [editingStream, setEditingStream] = useState<Stream | null>(null)
  const [globalMute, setGlobalMute] = useState(true)
  const multiviewerRef = useRef<HTMLDivElement>(null)

  // Load streams from the API when component mounts
  useEffect(() => {
    fetchStreams()
  }, [])

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

  const handleEditStream = (id: string) => {
    const streamToEdit = streams.find((stream) => stream.id === id)
    if (streamToEdit) {
      setEditingStream(streamToEdit)
    }
  }

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

  const handleFullscreen = () => {
    if (multiviewerRef.current) {
      if (!document.fullscreenElement) {
        multiviewerRef.current.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  }

  const toggleGlobalMute = () => {
    setGlobalMute((prev) => !prev)
  }

  return (
    <div className="min-h-screen bg-[#1a1b26] p-4">
      <div className="flex justify-end gap-2 mb-6">
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

      <div ref={multiviewerRef} className="grid grid-cols-5 gap-4">
        {Array.from({ length: 25 }).map((_, index) => {
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

