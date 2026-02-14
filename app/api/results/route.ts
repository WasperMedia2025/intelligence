import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  const token = process.env.APIFY_TOKEN!;

  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  try {
    // Check run status first
    const runRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );
    const runJson = await runRes.json();
    const status = runJson?.data?.status;

    // If still running, return status only
    if (status !== "SUCCEEDED") {
      return NextResponse.json({ status }, { status: 200 });
    }

    // Get dataset ID
    const datasetId = runJson?.data?.defaultDatasetId;
    if (!datasetId) {
      return NextResponse.json(
        { error: "Dataset not ready yet" },
        { status: 200 }
      );
    }

    // Fetch scraped data
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${token}`
    );
    const items = await itemsRes.json();

    return NextResponse.json({ status: "SUCCEEDED", items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
