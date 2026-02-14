import { NextResponse } from "next/server";

type UiItem = {
  title: string;
  type: string;
  source: string;
  snippet: string;
  url?: string;
  rating?: number | null;
  raw?: any;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "google-maps";
  const q = searchParams.get("q") || "";

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ items: [], error: "Missing APIFY_TOKEN" }, { status: 500 });
  }

  // 1) Start the Apify Actor (Google Maps Scraper)
  // NOTE: This actor is for Google Maps business data. Trustpilot/Reddit/Quora will need separate actors later.
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [q],
        locationQuery: "Ireland",
        maxCrawledPlacesPerSearch: 10,
      }),
    }
  );

  const startJson = await startRes.json();
  const datasetId =
    startJson?.data?.defaultDatasetId || startJson?.data?.data?.defaultDatasetId;

  if (!datasetId) {
    return NextResponse.json({ items: [], error: "Could not find datasetId from Apify run" }, { status: 500 });
  }

  // 2) Fetch dataset items (this is the actual scraped data)
  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&token=${token}`
  );

  const rawItems = await itemsRes.json();

  // 3) Normalise into the exact format the UI needs
  const arr: any[] = Array.isArray(rawItems) ? rawItems : [];

  const normalized: UiItem[] = arr.map((p) => {
    const title = p.title || p.name || "Untitled";
    const rating =
      typeof p.totalScore === "number" ? p.totalScore :
      typeof p.rating === "number" ? p.rating :
      null;

    const url = p.url || p.website || p.googleUrl || p.searchPageUrl;

    const snippetParts = [
      p.categoryName,
      p.street,
      p.city,
      p.countryCode,
      p.phone,
    ].filter(Boolean);

    return {
      title,
      type: "business",
      source,
      snippet: snippetParts.join(" • "),
      url,
      rating,
      raw: p,
    };
  });

  // THIS is the important bit: UI expects { items: [...] }
  return NextResponse.json({ items: normalized });
}
