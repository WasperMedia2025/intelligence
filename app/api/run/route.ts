import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const token = process.env.APIFY_TOKEN!;

  try {
    // Start actor WITHOUT waiting
    const start = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [q],
          maxCrawledPlaces: 3,
          maxReviews: 10,
        }),
      }
    );

    const run = await start.json();

    if (!run?.data?.id) {
      return NextResponse.json(
        { error: "Failed to start Apify run" },
        { status: 500 }
      );
    }

    // RETURN RUN ID IMMEDIATELY
    return NextResponse.json({
      status: "started",
      runId: run.data.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
