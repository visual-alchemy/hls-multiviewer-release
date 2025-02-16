"use client"

import { useState, type ReactNode } from "react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: ReactNode
  trigger?: ReactNode
}

export const Dialog = ({ open, onOpenChange, children, trigger }: DialogProps) => {
  return (
    <>
      <div onClick={() => onOpenChange(true)}>{trigger}</div>
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? "block" : "hidden"}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
        <div className="relative z-50 w-full max-w-lg p-4 mx-auto">{children}</div>
      </div>
    </>
  )
}

export const DialogContent = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative bg-[#1f2937] text-white rounded-lg shadow-lg border border-gray-700">
      <div className="p-6">{children}</div>
    </div>
  )
}

export const DialogHeader = ({ children }: { children: ReactNode }) => {
  return <header className="mb-4">{children}</header>
}

export const DialogTitle = ({ children }: { children: ReactNode }) => {
  return <h2 className="text-lg font-semibold text-white">{children}</h2>
}

export const DialogDescription = ({ children }: { children: ReactNode }) => {
  return <p className="text-sm text-gray-400">{children}</p>
}

export const useDialog = () => {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}

