"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Props interface for the AddStreamDialog component
interface AddStreamDialogProps {
  onAdd: (title: string, url: string) => void
  onClose?: () => void
  isOpen?: boolean
  initialTitle?: string
  initialUrl?: string
  trigger?: React.ReactNode
}

// AddStreamDialog component for adding or editing stream details
export function AddStreamDialog({
  onAdd,
  onClose,
  isOpen,
  initialTitle = "",
  initialUrl = "",
  trigger,
}: AddStreamDialogProps) {
  // State for managing form inputs
  const [title, setTitle] = useState(initialTitle)
  const [url, setUrl] = useState(initialUrl)
  const [open, setOpen] = useState(false)
  const dialogDescriptionId = React.useId()

  // Effect to control dialog open state
  useEffect(() => {
    if (isOpen !== undefined) {
      setOpen(isOpen)
    }
  }, [isOpen])

  // Effect to update form inputs when editing an existing stream
  useEffect(() => {
    setTitle(initialTitle)
    setUrl(initialUrl)
  }, [initialTitle, initialUrl])

  // Function to handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd(title, url)
    setTitle("")
    setUrl("")
    setOpen(false)
    onClose?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-[#1f2937] border-gray-700" aria-describedby={dialogDescriptionId}>
        <DialogHeader>
          <DialogTitle className="text-white">{initialTitle ? "Edit Stream" : "Add New Stream"}</DialogTitle>
          <DialogDescription id={dialogDescriptionId} className="text-gray-400">
            {initialTitle
              ? "Update the details of the existing stream."
              : "Enter the details to add a new video stream to the multiviewer."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-200">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter stream title"
              required
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url" className="text-gray-200">
              Stream URL
            </Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter stream URL (HLS, FLV, etc.)"
              required
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Button type="submit" className="w-full">
            {initialTitle ? "Update" : "Add"} Stream
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

