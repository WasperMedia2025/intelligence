import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  try {
    if (!APIFY_TOKEN) {
      return NextResponse.json({ error: "Missing APIFY_TOKEN" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source");
    const q = searchParams.get("q");

    if (!source || !q) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    let actorId = "";

    switch (source) {
      case "google-maps":
        actorId = "compass/crawler-google-places";
        break;
      case "trustpilot":
        actorId = "epctex/trustpilot-scraper";
        break;
      case "reddit":
        actorId = "trudax/reddit-scraper";
        break;
      case "quora":
        actorId = "cyberfly/quora-scraper";
        break;
      case "trends":
        actorId = "easyapi/google-trends";
        break;
      default:
        return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const input =
      source === "google-maps"
        ? {
            searchStringsArray: [q],
            locationQuery: "Ireland",
            maxCrawledPlacesPerSearch: 10,
          }
        : { search: q };

    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!runRes.ok) {
      const text = await runRes.text();
      return NextResponse.json({ error: "Apify run failed", details: text }, { status: 500 });
    }

    const runData = await runRes.json();
    const datasetId = runData?.data?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json({ error: "No datasetId returned" }, { status: 500 });
    }

    await new Promise((r) => setTimeout(r, 8000));

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );

    const items = await itemsRes.json();

    const normalized = items.map((i: any) => ({
      title: i.name || i.title || "Unknown",
      type: source,
      source,
      snippet: i.text || i.description || "",
      url: i.url || "",
      rating: i.rating || null,
    }));

    return NextResponse.json({ items: normalized });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

