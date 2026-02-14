import { NextResponse } from "next/server";

type Source = "google-maps" | "reddit" | "quora" | "trustpilot" | "trends";

type RunBody = {
  q?: string;
  source?: Source;
  dateRangeDays?: number; // 0 = all time
  minRating?: number; // 0 = any
  maxPlaces?: number; // small number
  maxReviews?: number; // small number
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(v: any) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function parseDateMaybe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function withinDays(d: Date | null, days: number) {
  if (!days || days <= 0) return true;
  if (!d) return true; // if we don't have a date from the actor, we can't filter reliably
  const now = Date.now();
  const diff = now - d.getTime();
  const limit = days * 24 * 60 * 60 * 1000;
  return diff <= limit;
}

/**
 * Normalise Apify Google Maps/Places items into:
 * - place rows (type: "place")
 * - review rows (type: "review")
 */
function normaliseGoogle(items: any[], opts: { dateRangeDays: number; minRating: number; maxReviews: number }) {
  const out: any[] = [];

  for (const it of items || []) {
    const placeName =
      it.title ||
      it.name ||
      it.placeName ||
      it.companyName ||
      it?.basicInfo?.name ||
      "Unknown place";

    const placeUrl =
      it.url ||
      it.placeUrl ||
      it.googleUrl ||
      it.searchPageUrl ||
      it.website ||
      it?.basicInfo?.website ||
      "";

    const placeRating =
      toNumber(it.totalScore ?? it.rating ?? it.stars ?? it?.basicInfo?.rating, 0) || 0;

    const placeReviewsCount =
      toNumber(it.reviewsCount ?? it.reviews ?? it.numberOfReviews ?? it?.basicInfo?.reviewsCount, 0) || 0;

    // Place row (so you always see something even if reviews array missing)
    out.push({
      title: placeName,
      type: "place",
      source: "Google Maps",
      snippet: safeText(it.address || it?.location?.address || it?.basicInfo?.address || ""),
      url: placeUrl,
      rating: placeRating || null,
      date: null,
      meta: {
        reviewsCount: placeReviewsCount || null,
        phone: it.phone || it.phoneUnformatted || it?.basicInfo?.phone || null,
      },
    });

    // Reviews can appear under different keys depending on actor
    const reviewsArr =
      it.reviews ||
      it.reviewData ||
      it?.reviewsData ||
      it?.latestReviews ||
      [];

    if (Array.isArray(reviewsArr) && reviewsArr.length) {
      let pushed = 0;

      for (const r of reviewsArr) {
        if (pushed >= opts.maxReviews) break;

        const rating = toNumber(r.rating ?? r.stars ?? r.score, 0) || 0;

        if (opts.minRating > 0 && rating > 0 && rating < opts.minRating) continue;

        const date =
          parseDateMaybe(r.publishedAt) ||
          parseDateMaybe(r.publishAt) ||
          parseDateMaybe(r.date) ||
          parseDateMaybe(r.createdAt) ||
          null;

        if (!withinDays(date, opts.dateRangeDays)) continue;

        const text =
          safeText(r.text || r.reviewText || r.snippet || r.content || "").trim();

        const author =
          safeText(r.userName || r.authorName || r.name || r.author || "");

        const reviewUrl = safeText(r.url || r.reviewUrl || "");

        out.push({
          title: author ? `${author} on ${placeName}` : `Review on ${placeName}`,
          type: "review",
          source: "Google Reviews",
          snippet: text || "(No review text)",
          url: reviewUrl || placeUrl,
          rating: rating || null,
          date: date ? date.toISOString() : null,
          meta: {
            place: placeName,
          },
        });

        pushed++;
      }
    }
  }

  return out;
}

/**
 * Calls Apify run-sync-get-dataset-items so we actually get items back in one request.
 * This is best ONLY for small runs (which is what you want for an internal research UI).
 */
async function apifyRunSyncGetDatasetItems(actorId: string, token: string, input: any) {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&format=json&clean=true`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  // Always return JSON to the UI (even if Apify returned HTML/text)
  if (!res.ok) {
    let details: any = rawText;
    if (contentType.includes("application/json")) {
      try {
        details = JSON.parse(rawText);
      } catch {
        // keep as text
      }
    }
    throw new Error(
      typeof details === "string"
        ? details.slice(0, 400)
        : JSON.stringify(details).slice(0, 400)
    );
  }

  if (!contentType.includes("application/json")) {
    // Apify sometimes returns non-json on errors, but if we got here it was ok.
    // Still guard, because UI expects JSON.
    return [];
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return NextResponse.json(
        { items: [], error: "Missing APIFY_TOKEN on server (Vercel env var)." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as RunBody;

    const q = (body.q || "").trim();
    const source = (body.source || "google-maps") as Source;

    const dateRangeDays = clamp(toNumber(body.dateRangeDays, 0), 0, 365);
    const minRating = clamp(toNumber(body.minRating, 0), 0, 5);

    // HARD LIMITS so you don’t trigger 196 pages / huge runs again
    const maxPlaces = clamp(toNumber(body.maxPlaces, 3), 1, 8);
    const maxReviews = clamp(toNumber(body.maxReviews, 10), 0, 30);

    if (!q) {
      return NextResponse.json(
        { items: [], error: "Please enter a search term." },
        { status: 400 }
      );
    }

    // Only Google is “fully wired” right now.
    // Others return a clear message (and don’t break your UI).
    if (source !== "google-maps") {
      return NextResponse.json({
        items: [],
        meta: { note: `Source "${source}" is not wired yet in this build.` },
      });
    }

    // Actor you were already using in your earlier tests
    const actorId = "compass/crawler-google-places";

    // Input: keep it small + review focused
    const input = {
      searchStringsArray: [q],
      locationQuery: "Ireland",
      maxCrawledPlacesPerSearch: maxPlaces,

      // These fields vary by actor version, but they’re safe to send.
      // If the actor supports them, great; if not, it ignores unknown fields.
      language: "en",
      includeReviews: true,
      maxReviews: maxReviews,
      scrapeReviews: true,
      maxImages: 0,
    };

    const apifyItems = await apifyRunSyncGetDatasetItems(actorId, token, input);

    const normalised = normaliseGoogle(apifyItems, {
      dateRangeDays,
      minRating,
      maxReviews,
    });

    return NextResponse.json({
      items: normalised,
      meta: {
        q,
        source,
        dateRangeDays,
        minRating,
        maxPlaces,
        maxReviews,
        returned: normalised.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        items: [],
        error: "Apify run failed",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
