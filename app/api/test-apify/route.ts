import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  // Cheap test run: 1 place only
  const input = {
    searchStringsArray: ["Grid Finance"],
    locationQuery: "Dublin, Ireland",
    maxCrawledPlacesPerSearch: 1
  };

  const res = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  const json = await res.json();
  return NextResponse.json(json, { status: res.ok ? 200 : 500 });
}
