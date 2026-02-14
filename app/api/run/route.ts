import { NextResponse } from "next/server";

type Source = "google-maps" | "reddit" | "quora" | "trustpilot" | "trends";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const source = (body?.source || "google-maps") as Source;
  const q = String(body?.q || "").trim();

  const maxPlaces = clamp(Number(body?.maxPlaces ?? 3), 1, 20);
  const maxReviews = clamp(Number(body?.maxReviews ?? 10), 1, 50);

  if (!q) {
    return NextResponse.json({ error: "Missing q (search query)" }, { status: 400 });
  }

  // Stabilise Google first (others will be added after this is solid)
  if (source !== "google-maps") {
    return NextResponse.json(
      {
        error: `Source "${source}" not wired yet.`,
        note: "Google Reviews is stabilised first, then Reddit/Quora/Trustpilot/Trends will be added.",
      },
      { status: 400 }
    );
  }

  try {
    // IMPORTANT: waitForFinish=0 returns immediately (prevents Vercel timeout)
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}&waitForFinish=0`,
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

    const text = await startRes.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Apify returned non-JSON", details: text.slice(0, 500) },
        { status: 500 }
      );
    }

    const runId = json?.data?.id;
    if (!runId) {
      return NextResponse.json(
        { error: "Failed to start Apify run", details: json },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "started",
      runId,
      meta: { q, maxPlaces, maxReviews },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Start run failed", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
