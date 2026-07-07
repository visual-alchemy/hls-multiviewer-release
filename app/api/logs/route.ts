import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const LOG_DIR = path.join(process.cwd(), "data", "logs")
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Helper to format date in DD-MM-YYYY using Asia/Jakarta timezone (Vidio standard)
function getLocalDateString(timestamp?: number) {
  const date = timestamp ? new Date(timestamp) : new Date()
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  })
  return formatter.format(date).replace(/\//g, "-")
}

// Helper to format time in HH:MM:SS using Asia/Jakarta timezone
function getLocalTimeString(timestamp?: number) {
  const date = timestamp ? new Date(timestamp) : new Date()
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
  return formatter.format(date)
}

// Auto-cleanup logs older than 7 days
function cleanOldLogs() {
  if (!fs.existsSync(LOG_DIR)) return

  try {
    const files = fs.readdirSync(LOG_DIR)
    const now = Date.now()

    for (const file of files) {
      if (!file.endsWith(".log")) continue
      const filePath = path.join(LOG_DIR, file)
      try {
        const stats = fs.statSync(filePath)
        if (now - stats.mtimeMs > RETENTION_MS) {
          fs.unlinkSync(filePath)
          console.log(`[logs] Cleaned up expired log file: ${file}`)
        }
      } catch (err) {
        console.error(`[logs] Error reading stats or deleting file ${file}:`, err)
      }
    }
  } catch (err) {
    console.error("[logs] Error running log cleanup:", err)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { stream, state, event, message, timestamp, data } = body

    // Ensure logs directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }

    const logDate = getLocalDateString(timestamp)
    const logTime = getLocalTimeString(timestamp)
    const filePath = path.join(LOG_DIR, `${logDate}.log`)

    // Format: [HH:MM:SS] [Stream] [STATE] - message {optional metadata}
    let dataStr = ""
    if (data !== undefined && data !== null) {
      dataStr = ` ${JSON.stringify(data)}`
    }
    const logLine = `[${logTime}] [${stream}] [${state.toUpperCase()}] [${event.toUpperCase()}] - ${message}${dataStr}\n`

    // Append to file
    fs.appendFileSync(filePath, logLine)

    // Run cleanups in background (non-blocking)
    cleanOldLogs()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[logs] Error writing log entry:", err)
    return NextResponse.json({ error: "Failed to write log entry" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateQuery = searchParams.get("date")
    const download = searchParams.get("download") === "true"

    const todayDate = getLocalDateString()
    const targetDate = dateQuery || todayDate

    // Path traversal prevention: validate target date pattern (DD-MM-YYYY)
    if (!/^\d{2}-\d{2}-\d{4}$/.test(targetDate)) {
      return NextResponse.json({ error: "Invalid date format. Use DD-MM-YYYY" }, { status: 400 })
    }

    const filePath = path.join(LOG_DIR, `${targetDate}.log`)

    let fileContent = ""
    if (fs.existsSync(filePath)) {
      fileContent = fs.readFileSync(filePath, "utf-8")
    } else {
      fileContent = `=== HLS Multiviewer System Logs: ${targetDate} ===\nNo logs recorded for this day yet.\n`
    }

    if (download) {
      return new Response(fileContent, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="hls-multiviewer-${targetDate}.log"`,
        },
      })
    }

    return NextResponse.json({ content: fileContent })
  } catch (err) {
    console.error("[logs] Error reading log file:", err)
    return NextResponse.json({ error: "Failed to read log file" }, { status: 500 })
  }
}
