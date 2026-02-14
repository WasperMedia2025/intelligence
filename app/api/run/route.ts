import { NextResponse } from "next/server";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function startApifyRun(input: {
  q: string;
  maxPlaces?: number;
  maxReviews?: number;
}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  const q = (input.q || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const maxPlaces = clamp(Number(input.maxPlaces ?? 3), 1, 50);
  const maxReviews = clamp(Number(input.maxReviews ?? 10), 0, 200);

  try {
    const start = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [q],
          maxCrawledPlaces: maxPlaces,
          maxReviews: maxReviews,
        }),
      }
    );

    const text = await start.text();
    let run: any;
    try {
      run = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Apify start returned non-JSON", details: text },
        { status: 500 }
      );
    }

    const runId = run?.data?.id;
    if (!runId) {
      return NextResponse.json(
        { error: "Failed to start Apify run", details: run },
        { status: 500 }
      );
    }

    // Return immediately (important to avoid Vercel timeout)
    return NextResponse.json({ status: "started", runId });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Apify request failed", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return startApifyRun({
    q: body?.q,
    maxPlaces: body?.maxPlaces,
    maxReviews: body?.maxReviews,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  return startApifyRun({
    q: searchParams.get("q") || "",
    maxPlaces: Number(searchParams.get("maxPlaces") || 3),
    maxReviews: Number(searchParams.get("maxReviews") || 10),
  });
}
