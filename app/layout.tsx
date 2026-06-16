import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { LogExporter } from "@/components/log-exporter"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Multiviewer",
  description: "A multiviewer application for streaming media",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <LogExporter />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'