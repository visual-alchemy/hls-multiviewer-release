import { describe, it, expect, afterEach } from "vitest"
import { POST, GET } from "../../app/api/logs/route"
import fs from "fs"
import path from "path"

const LOG_DIR = path.join(process.cwd(), "data", "logs")

describe("Logs API Endpoints", () => {
  afterEach(() => {
    // Clean up any test log files created during runs
    if (fs.existsSync(LOG_DIR)) {
      try {
        const files = fs.readdirSync(LOG_DIR)
        for (const file of files) {
          if (file.endsWith(".log")) {
            fs.unlinkSync(path.join(LOG_DIR, file))
          }
        }
      } catch (err) {
        console.error("Clean up failed:", err)
      }
    }
  })

  it("POST writes a formatted log line to the file", async () => {
    const timestamp = Date.now()
    const body = {
      stream: "test-stream",
      state: "playing",
      event: "play_recovered",
      message: "Test stream is running smoothly",
      timestamp,
      data: { activeViewers: 1 }
    }

    const request = new Request("http://localhost/api/logs", {
      method: "POST",
      body: JSON.stringify(body)
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.success).toBe(true)

    // Verify the log file is generated in directory
    const files = fs.readdirSync(LOG_DIR)
    expect(files.length).toBeGreaterThan(0)
    
    const filePath = path.join(LOG_DIR, files[0])
    const content = fs.readFileSync(filePath, "utf-8")
    
    expect(content).toContain("[test-stream]")
    expect(content).toContain("[PLAYING] [PLAY_RECOVERED]")
    expect(content).toContain("Test stream is running smoothly")
    expect(content).toContain('{"activeViewers":1}')
  })

  it("GET retrieves existing log contents", async () => {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    const mockDate = "10-10-2020"
    const filePath = path.join(LOG_DIR, `${mockDate}.log`)
    fs.writeFileSync(filePath, "Log row 1\nLog row 2\n")

    const request = new Request(`http://localhost/api/logs?date=${mockDate}`)
    const response = await GET(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.content).toBe("Log row 1\nLog row 2\n")
  })

  it("GET returns warning statement for missing log file", async () => {
    const request = new Request("http://localhost/api/logs?date=25-12-1980")
    const response = await GET(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.content).toContain("No logs recorded for this day yet.")
  })

  it("GET yields attachment download headers when download=true is passed", async () => {
    const mockDate = "11-11-2011"
    const filePath = path.join(LOG_DIR, `${mockDate}.log`)
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
    fs.writeFileSync(filePath, "System boot log info\n")

    const request = new Request(`http://localhost/api/logs?date=${mockDate}&download=true`)
    const response = await GET(request)
    expect(response.status).toBe(200)

    expect(response.headers.get("Content-Disposition")).toContain(`attachment; filename="hls-multiviewer-${mockDate}.log"`)
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8")

    const text = await response.text()
    expect(text).toBe("System boot log info\n")
  })

  it("GET fails with 400 when invalid date format is passed", async () => {
    const request = new Request("http://localhost/api/logs?date=2024/06/22")
    const response = await GET(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe("Invalid date format. Use DD-MM-YYYY")
  })
})
