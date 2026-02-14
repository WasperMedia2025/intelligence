import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  // Step 1: Start actor run
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

  const datasetId = runData.data.defaultDatasetId;

  // Wait 10 seconds for scraping to complete
  await new Promise((r) => setTimeout(r, 10000));

  // Step 2: Fetch scraped results
  const resultsRes = await fetch(
    `https://api.apify.com/v2/dat
