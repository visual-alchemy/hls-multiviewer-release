import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing stream ID" }, { status: 400 });
  }

  const url = `https://api.vidio.com/livestreamings/${id}/stream?initialize=true`;

  const headers = new Headers({
    "sec-ch-ua-platform": '"Windows"',
    "Referer": "https://www.vidio.com/",
    "Accept-Language": "en",
    "sec-ch-ua": '"Brave";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "sec-ch-ua-mobile": "?0",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    "X-Secure-Level": "2",
    "X-API-Platform": "web-desktop",
  });

  // Add sensitive headers from environment variables
  if (process.env.VIDIO_API_KEY) headers.set("X-Api-Key", process.env.VIDIO_API_KEY);
  if (process.env.VIDIO_SIGNATURE) headers.set("X-Signature", process.env.VIDIO_SIGNATURE);
  if (process.env.VIDIO_LUWS) headers.set("luws", process.env.VIDIO_LUWS);
  if (process.env.VIDIO_USER_EMAIL) headers.set("X-User-Email", process.env.VIDIO_USER_EMAIL);
  if (process.env.VIDIO_CLIENT) headers.set("X-Client", process.env.VIDIO_CLIENT);

  try {
    const res = await fetch(url, { headers });
    const data = await res.json();

    if (!res.ok) {
      console.error(`[resolve] Vidio API returned ${res.status} for stream ${id}:`, JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ errors: [{ code: res.status, detail: `Upstream returned ${res.status}` }] }, { status: 502 });
    }

    // Diagnostic: log response shape to help debug .m3u8 extraction failures
    const topKeys = typeof data === "object" && data !== null ? Object.keys(data as Record<string, unknown>) : [];
    console.log(`[resolve] Stream ${id}: HTTP ${res.status}, top-level keys: ${topKeys.join(", ") || "none"}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error resolving Vidio stream:", error);
    return NextResponse.json({ error: "Failed to fetch from API" }, { status: 500 });
  }
}
