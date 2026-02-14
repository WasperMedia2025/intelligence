import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" });
  }

  // Example research query
  const input = {
    searchStringsArray: ["solar companies"],
    locationQuery: "Ireland",
    maxCrawledPlacesPerSearch: 5,
  };

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  const runData = await runRes.json();

  const datasetId = runData.data.defaultDatasetId;

  // Wait briefly so Apify finishes
  await new Promise((r) => setTimeout(r, 8000));

  const dataRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
  );

  const items = await dataRes.json();

  return NextResponse.json(items);
}
