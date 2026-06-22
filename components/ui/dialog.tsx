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
      {trigger && <div onClick={() => onOpenChange(true)}>{trigger}</div>}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? "block" : "hidden"}`}>
        <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    </>
  )
}

export const DialogContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  const hasMaxWidth = className && className.includes("max-w-")
  const defaultClasses = `relative z-50 w-full mx-auto bg-[#1f2937] text-white rounded-lg shadow-lg border border-gray-700 ${hasMaxWidth ? "" : "max-w-lg"}`
  const isFlex = className && className.includes("flex-col")

  return (
    <div className={`${defaultClasses} ${className || ""}`}>
      <div className={`p-6 max-h-[85vh] ${isFlex ? "h-full flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
        {children}
      </div>
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

