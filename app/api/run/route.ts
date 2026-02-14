import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return NextResponse.json(
        { items: [], error: "Missing APIFY_TOKEN in Vercel env vars" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "google-maps";
    const q = searchParams.get("q") || "";

    // Safety
    if (!q.trim()) {
      return NextResponse.json(
        { items: [], error: "Missing query (q)" },
        { status: 400 }
      );
    }

    // NOTE: For now we only implemented Google Maps via Apify.
    // Other sources can return a clear JSON message (so UI doesn't break).
    if (source !== "google-maps") {
      return NextResponse.json(
        { items: [], error: `Source "${source}" not wired yet (UI is ready).` },
        { status: 200 }
      );
    }

    // Apify actor
    const actorId = "compass/crawler-google-places";

    // Smaller input so it runs fast + cheap
    const input = {
      searchStringsArray: [q],
      locationQuery: "Ireland",
      maxCrawledPlacesPerSearch: 10,
      // Turn ON reviews only if you want (can increase cost/time):
      // includeReviews: true,
      // maxReviews: 20,
    };

    // Start actor run
    const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const startText = await startRes.text();
    let startJson: any;
    try {
      startJson = JSON.parse(startText);
    } catch {
      return NextResponse.json(
        { items: [], error: "Apify start run returned non-JSON", details: startText.slice(0, 500) },
        { status: 500 }
      );
    }

    if (!startRes.ok) {
      return NextResponse.json(
        { items: [], error: "Apify request failed", details: startJson },
        { status: 500 }
      );
    }

    const datasetId = startJson?.data?.defaultDatasetId;
    if (!datasetId) {
      return NextResponse.json(
        { items: [], error: "Could not find datasetId from Apify run", details: startJson },
        { status: 500 }
      );
    }

    // Fetch dataset items
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const itemsText = await itemsRes.text();
    let itemsJson: any;
    try {
      itemsJson = JSON.parse(itemsText);
    } catch {
      return NextResponse.json(
        { items: [], error: "Apify dataset returned non-JSON", details: itemsText.slice(0, 500) },
        { status: 500 }
      );
    }

    // Normalize (simple)
    const normalized = (Array.isArray(itemsJson) ? itemsJson : []).map((x: any) => ({
      title: x?.title || x?.name || "Untitled",
      type: "business",
      source: "google-maps",
      snippet: x?.address || x?.description || "",
      url: x?.url || x?.website || "",
      rating: x?.totalScore ?? x?.rating ?? null,
    }));

    return NextResponse.json({ items: normalized });
  } catch (err: any) {
    return NextResponse.json(
      { items: [], error: "Server crashed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
