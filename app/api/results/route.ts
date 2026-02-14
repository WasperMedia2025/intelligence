import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const token = process.env.APIFY_TOKEN;

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    // 1️⃣ Check run status
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );

    const statusData = await statusRes.json();
    const status = statusData.data.status;

    // If still running → tell frontend to keep polling
    if (status !== "SUCCEEDED") {
      return NextResponse.json({
        status,
        items: [],
      });
    }

    // 2️⃣ Fetch results from dataset
    const datasetId = statusData.data.defaultDatasetId;

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true`
    );

    const items = await itemsRes.json();

    // 3️⃣ Return formatted results
    const normalized = items.flatMap((place: any) =>
      (place.reviews || []).map((r: any) => ({
        title: place.title,
        type: "Google Review",
        source: "Google Maps",
        snippet: r.text,
        rating: r.stars,
      }))
    );

    return NextResponse.json({
      status: "done",
      items: normalized,
    });

  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
