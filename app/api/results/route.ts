import { NextResponse } from "next/server";

function normaliseGoogle(rawPlaces: any[], maxReviews: number) {
  const items: any[] = [];
  let reviewsFetched = 0;

  for (const place of rawPlaces || []) {
    const placeTitle = place?.title || place?.name || "Place";
    const placeUrl = place?.url || place?.placeUrl || place?.website || "";

    const reviews = Array.isArray(place?.reviews) ? place.reviews : [];

    // Always include a place row (so you can see something even if reviews missing)
    items.push({
      title: placeTitle,
      type: "business",
      source: "Google Maps",
      snippet: place?.address || place?.categoryName || "Business result",
      url: placeUrl,
      rating: place?.totalScore ? Number(place.totalScore) : null,
      date: null,
    });

    for (const r of reviews.slice(0, maxReviews)) {
      reviewsFetched++;

      items.push({
        title: `${placeTitle} — ${r?.name || r?.author || "Reviewer"}`,
        type: "review",
        source: "Google Reviews",
        snippet: String(r?.text || r?.reviewText || r?.snippet || "Review text not available").trim(),
        url: placeUrl,
        rating: r?.stars ?? r?.rating ?? null,
        date: r?.publishedAt || r?.date || null,
      });
    }
  }

  return { items, reviewsFetched, placesFetched: rawPlaces?.length || 0 };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId") || "";
  const maxReviews = clamp(Number(searchParams.get("maxReviews") || "10"), 1, 50);

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    // 1) Check run status
    const runRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${token}`
    );

    const runText = await runRes.text();
    let runJson: any;
    try {
      runJson = JSON.parse(runText);
    } catch {
      return NextResponse.json(
        { error: "Run status returned non-JSON", details: runText.slice(0, 500) },
        { status: 500 }
      );
    }

    const status = runJson?.data?.status;
    if (!status) {
      return NextResponse.json(
        { error: "Could not read run status", details: runJson },
        { status: 500 }
      );
    }

    // If still running: tell frontend to keep polling
    if (status !== "SUCCEEDED") {
      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return NextResponse.json(
          { status, error: "Apify run failed", details: runJson?.data },
          { status: 500 }
        );
      }
      return NextResponse.json({ status, items: [], meta: { placesFetched: 0, reviewsFetched: 0 } }, { status: 200 });
    }

    // 2) Fetch dataset items
    const datasetId = runJson?.data?.defaultDatasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: "Run SUCCEEDED but datasetId missing", details: runJson?.data },
        { status: 500 }
      );
    }

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&token=${token}`
    );

    const itemsText = await itemsRes.text();
    let rawItems: any;
    try {
      rawItems = JSON.parse(itemsText);
    } catch {
      return NextResponse.json(
        { error: "Dataset returned non-JSON", details: itemsText.slice(0, 500) },
        { status: 500 }
      );
    }

    if (!Array.isArray(rawItems)) {
      return NextResponse.json(
        { error: "Dataset items were not an array", details: rawItems },
        { status: 500 }
      );
    }

    const { items, placesFetched, reviewsFetched } = normaliseGoogle(rawItems, maxReviews);

    return NextResponse.json(
      {
        status: "SUCCEEDED",
        items,
        meta: { placesFetched, reviewsFetched },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Results fetch failed", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
