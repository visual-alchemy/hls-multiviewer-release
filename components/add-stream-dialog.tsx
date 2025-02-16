"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddStreamDialogProps {
  onAdd: (title: string, url: string) => void
  onClose?: () => void
  isOpen: boolean
  initialTitle?: string
  initialUrl?: string
}

export function AddStreamDialog({ onAdd, onClose, isOpen, initialTitle = "", initialUrl = "" }: AddStreamDialogProps) {
  const [title, setTitle] = useState(initialTitle)
  const [url, setUrl] = useState(initialUrl)
  const dialogDescriptionId = React.useId()

  useEffect(() => {
    setTitle(initialTitle)
    setUrl(initialUrl)
  }, [initialTitle, initialUrl])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd(title, url)
    setTitle("")
    setUrl("")
    onClose?.()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={dialogDescriptionId}>
        <DialogHeader>
          <DialogTitle>{initialTitle ? "Edit Stream" : "Add New Stream"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter stream title"
              required
              className="bg-gray-800 border-gray-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Stream URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter stream URL (HLS, FLV, etc.)"
              required
              className="bg-gray-800 border-gray-600"
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            {initialTitle ? "Update" : "Add"} Stream
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

