import { NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_TOKEN;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source");
    const q = searchParams.get("q");

    if (!source || !q) {
      return NextResponse.json(
        { error: "Missing source or query" },
        { status: 400 }
      );
    }

    if (!APIFY_TOKEN) {
      return NextResponse.json(
        { error: "Missing APIFY_TOKEN env variable" },
        { status: 500 }
      );
    }

    // ---- MAP SOURCE → ACTOR ----

    let actorId = "";

    if (source === "google-maps") {
      actorId = "compass/crawler-google-places";
    }

    if (source === "trustpilot") {
      actorId = "epctex/trustpilot-scraper";
    }

    if (source === "reddit") {
      actorId = "trudax/reddit-scraper";
    }

    if (source === "quora") {
      actorId = "cyberfly/quora-scraper";
    }

    if (source === "trends") {
      actorId = "easyapi/google-trends";
    }

    if (!actorId) {
      return NextResponse.json(
        { error: "Unknown source" },
        { status: 400 }
      );
    }

    // ---- PREPARE INPUT ----

    let input: any = {};

    if (source === "google-maps") {
      input = {
        searchStringsArray: [q],
        locationQuery: "Ireland",
        maxCrawledPlacesPerSearch: 10,
      };
    } else {
      input = { search: q };
    }

    // ---- RUN APIFY ACTOR ----

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
      return NextResponse.json(
        { error: "Apify request failed", details: text },
        { status: 500 }
      );
    }

    const runJson = await runRes.json();
    const datasetId = runJson?.data?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json(
        { error: "Could not find datasetId from Apify run" },
        { status: 500 }
      );
    }

    // ---- WAIT A BIT FOR RESULTS ----

    await new Promise((r) => setTimeout(r, 8000));

    // ---- FETCH RESULTS ----

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );

    if (!itemsRes.ok) {
      const text = await itemsRes.text();
      return NextResponse.json(
        { error: "Failed fetching dataset", details: text },
        { status: 500 }
      );
    }

    const items = await itemsRes.json();

    // ---- NORMALISE OUTPUT ----

    const normalized = items.map((item: any) => ({
      title: item.name || item.title || item.author || "Unknown",
      type: source,
      source,
      snippet:
        item.text ||
        item.description ||
        item.snippet ||
        item.reviewText ||
        "",
      url: item.url || item.link || "",
      rating: item.rating || item.score || null,
    }));

    return NextResponse.json({ items: normalized });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
