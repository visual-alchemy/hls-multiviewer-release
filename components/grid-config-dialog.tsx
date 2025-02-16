"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface GridConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfigChange: (rows: number, columns: number) => void
  initialRows: number
  initialColumns: number
}

export function GridConfigDialog({
  isOpen,
  onClose,
  onConfigChange,
  initialRows,
  initialColumns,
}: GridConfigDialogProps) {
  const [rows, setRows] = useState(initialRows)
  const [columns, setColumns] = useState(initialColumns)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfigChange(rows, columns)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Grid Layout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rows">Rows</Label>
            <Input
              id="rows"
              type="number"
              min="1"
              max="10"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="bg-gray-800 border-gray-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="columns">Columns</Label>
            <Input
              id="columns"
              type="number"
              min="1"
              max="10"
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              className="bg-gray-800 border-gray-600"
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Apply Configuration
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

