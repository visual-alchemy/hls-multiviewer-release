/**
 * Recursively searches an arbitrary JSON value for strings containing ".m3u8".
 * Returns all matching URLs found, longest first.
 */
export function findM3u8Urls(data: unknown): string[] {
  const results: string[] = []
  const seen = new Set<unknown>()

  function walk(value: unknown) {
    if (value == null || seen.has(value)) return
    seen.add(value)

    if (typeof value === "string") {
      if (value.includes(".m3u8")) {
        results.push(value)
      }
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item)
    } else if (typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) {
        walk(v)
      }
    }
  }

  walk(data)

  // Sort descending by length — longest URL is usually the master playlist
  results.sort((a, b) => b.length - a.length)
  return results
}

/**
 * Extracts a summary of the JSON structure for diagnostics.
 * Returns an array of top-level key paths with their value types.
 */
export function describeJsonStructure(data: unknown, maxDepth = 3): string[] {
  const lines: string[] = []

  function walk(value: unknown, path: string, depth: number) {
    if (depth > maxDepth || value == null) return

    if (Array.isArray(value)) {
      lines.push(`${path}: array[${value.length}]`)
      if (value.length > 0) walk(value[0], `${path}[0]`, depth + 1)
    } else if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
      for (const [key, val] of entries) {
        if (typeof val === "string") {
          const preview = val.length > 80 ? val.slice(0, 80) + "..." : val
          lines.push(`${path}.${key}: string = "${preview}"`)
        } else {
          const type = Array.isArray(val) ? `array[${val.length}]` : typeof val
          lines.push(`${path}.${key}: ${type}`)
          if (depth < maxDepth - 1) walk(val, `${path}.${key}`, depth + 1)
        }
      }
    } else {
      lines.push(`${path}: ${typeof value}`)
    }
  }

  walk(data, "root", 0)
  return lines
}
