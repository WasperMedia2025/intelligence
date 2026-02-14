import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  // Start actor run
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: ["finance company Dublin"],
        maxCrawledPlacesPerSearch: 20,
      }),
    }
  );

  const runData = await runRes.json();
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;

  // Wait until run finishes
  let status = "RUNNING";

  while (status === "RUNNING" || status === "READY") {
    await new Promise((r) => setTimeout(r, 5000));

    const checkRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
    );

    const checkData = await checkRes.json();
    status = checkData.data.status;

    if (status === "SUCCEEDED") break;
  }

  // Fetch results
  const resultsRes = await fetch(
