import { NextResponse } from "next/server";

type Source =
  | "google-maps" // Google business + reviews
  | "reddit"
  | "quora"
  | "trustpilot"
  | "trends";

function jsonError(message: string, status = 500, details?: any) {
  return NextResponse.json(
    { items: [], error: message, details: details ?? null },
    { status }
  );
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseDays(v: string | null) {
  const d = Number(v);
  if (!Number.isFinite(d) || d < 0) return 0;
  return d;
}

function withinDays(isoOrDate: any, days: number) {
  if (!days) return true; // 0 => all time
  if (!isoOrDate) return true;
  const dt = new Date(isoOrDate);
  if (Number.isNaN(dt.getTime())) return true;
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return dt.getTime() >= cutoff;
}

function pickReviewDate(r: any) {
  return (
    r?.publishedAt ||
    r?.publishedAtDate ||
    r?.publishedAtDateTime ||
    r?.date ||
    r?.reviewDate ||
    null
  );
}

/**
 * IMPORTANT:
 * We use async pattern:
 * - First call starts run => returns { status:"RUNNING", runId }
 * - UI polls /api/run?runId=... until status SUCCEEDED
 * - Then route fetches dataset items and normalizes them
 */
export async function GET(req: Request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return jsonError("Missing APIFY_TOKEN in Vercel env vars", 500);

  const url = new URL(req.url);
  const source = (url.searchParams.get("source") || "") as Source;
  const q = (url.searchParams.get("q") || "").trim();

  const runId = (url.searchParams.get("runId") || "").trim();

  // Filters
  const maxPlaces = Math.min(toInt(url.searchParams.get("maxPlaces"), 8), 25);
  const maxReviews = Math.min(toInt(url.searchParams.get("maxReviews"), 20), 200);
  const minRating = Math.min(Math.max(toInt(url.searchParams.get("minRating"), 0), 0), 5);
  const days = parseDays(url.searchParams.get("days")); // 0 = all time

  if (!source) return jsonError("Missing source", 400);
  if (!q && source !== "trends") return jsonError("Missing q", 400);

  // --- 1) POLL EXISTING RUN (no timeout, quick request) ---
  if (runId) {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(
          token
        )}`,
        { cache: "no-store" }
      );
      const runJson = await runRes.json();

      const status = runJson?.data?.status as string | undefined;
      if (!status) return jsonError("Could not read Apify run status", 500, runJson);

      if (status === "RUNNING" || status === "READY") {
        return NextResponse.json({
          status,
          runId,
          message:
            "Apify run is still running. Keep polling until it finishes.",
        });
      }

      if (status !== "SUCCEEDED") {
        return jsonError("Apify run failed", 500, runJson);
      }

      const datasetId =
        runJson?.data?.defaultDatasetId ||
        runJson?.data?.output?.datasetId ||
        null;

      if (!datasetId) {
        return jsonError("Could not find datasetId from Apify run", 500, runJson);
      }

      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${encodeURIComponent(
          datasetId
        )}/items?clean=true&format=json&token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );

      const rawItems = await itemsRes.json();

      // Normalize based on source
      const normalized =
        source === "google-maps"
          ? normalizeGoogleMaps(rawItems, { minRating, days })
          : normalizeGeneric(rawItems, source);

      return NextResponse.json({
        status: "SUCCEEDED",
        runId,
        items: normalized,
      });
    } catch (e: any) {
      return jsonError("Polling Apify run failed", 500, { message: e?.message });
    }
  }

  // --- 2) START A NEW RUN (return immediately with runId) ---
  try {
    if (source === "google-maps") {
      // Use Google Maps Scraper actor that supports reviews well
      // Actor: apify/google-maps-scraper
      const actorId = "apify/google-maps-scraper";

      const input: any = {
        searchStringsArray: [q],
        // Keep it tight so it doesn't crawl 196 pages:
        maxCrawledPlacesPerSearch: maxPlaces,
        language: "en",
        // Reviews:
        scrapeReviews: true,
        maxReviews: maxReviews,
        // Keep costs/volume sane:
        includeImages: false,
        includeWebResults: false,
      };

      const startRes = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(
          actorId
        )}/runs?token=${encodeURIComponent(token)}&waitForFinish=0`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );

      const startJson = await startRes.json();
      const newRunId = startJson?.data?.id;

      if (!newRunId) return jsonError("Could not start Apify run", 500, startJson);

      return NextResponse.json({
        status: "RUNNING",
        runId: newRunId,
        message: "Started Apify run. Polling required.",
      });
    }

    // Other sources can be wired later to their actors.
    // For now return a stable response (no crashes).
    return NextResponse.json({
      status: "SUCCEEDED",
      runId: null,
      items: [],
      note: `Source "${source}" not wired to an actor yet. Google (business + reviews) is live.`,
    });
  } catch (e: any) {
    return jsonError("Apify request failed", 500, { message: e?.message });
  }
}

function normalizeGeneric(raw: any[], source: string) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((x: any, i: number) => ({
    id: `${source}-${i}`,
    title: x?.title || x?.name || x?.heading || "Item",
    type: x?.type || "item",
    source,
    snippet: x?.snippet || x?.text || x?.description || "",
    url: x?.url || x?.link || "",
    date: x?.date || null,
    rating: x?.rating || null,
  }));
}

/**
 * For Google Maps Scraper output:
 * It usually returns place objects (title/name, address, url, totalScore)
 * and may include a "reviews" array if scrapeReviews=true.
 */
function normalizeGoogleMaps(
  raw: any[],
  opts: { minRating: number; days: number }
) {
  if (!Array.isArray(raw)) return [];

  const out: any[] = [];
  let idx = 0;

  for (const place of raw) {
    const placeTitle = place?.title || place?.name || "Google place";
    const placeUrl = place?.url || place?.placeUrl || place?.googleUrl || "";
    const placeRating = place?.totalScore ?? place?.rating ?? null;

    const reviews = Array.isArray(place?.reviews) ? place.reviews : [];

    if (reviews.length) {
      for (const r of reviews) {
        const stars = r?.stars ?? r?.rating ?? null;
        const dt = pickReviewDate(r);

        if (opts.minRating && stars != null && Number(stars) < opts.minRating) continue;
        if (!withinDays(dt, opts.days)) continue;

        out.push({
          id: `google-review-${idx++}`,
          title: placeTitle,
          type: "review",
          source: "google",
          snippet: r?.text || r?.reviewText || r?.comment || "",
          url: placeUrl,
          date: dt,
          rating: stars,
        });
      }
    } else {
      // Still show the place as a fallback row
      out.push({
        id: `google-place-${idx++}`,
        title: placeTitle,
        type: "business",
        source: "google",
        snippet: place?.address || place?.fullAddress || "",
        url: placeUrl,
        date: null,
        rating: placeRating,
      });
    }
  }

  return out.slice(0, 200);
}
