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
  const q = (searchParams.get("q") || "").trim();

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ items: [], error: "Missing APIFY_TOKEN" }, { status: 500 });
  }
  if (!q) {
    return NextResponse.json({ items: [], error: "Missing query (q)" }, { status: 400 });
  }

  // Runs the actor AND returns items directly (no datasetId needed)
  const actorId = "compass~crawler-google-places";
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&clean=true`;

  const input = {
    searchStringsArray: [q],
    locationQuery: "Ireland",
    maxCrawledPlacesPerSearch: 10,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const rawItems = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { items: [], error: "Apify request failed", details: rawItems },
      { status: 500 }
    );
  }

  const arr: any[] = Array.isArray(rawItems) ? rawItems : [];

  const items: UiItem[] = arr.map((p) => {
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
      p.postalCode,
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

  return NextResponse.json({ items });
}
