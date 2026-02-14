import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  const input = {
    searchStringsArray: ["finance company Dublin"],
    locationQuery: "Dublin, Ireland",
    maxCrawledPlacesPerSearch: 5,
  };

  // This endpoint runs the actor and returns dataset items once finished
  const res = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&clean=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  const items = await res.json();

  return NextResponse.json(items, { status: res.ok ? 200 : 500 });
}
