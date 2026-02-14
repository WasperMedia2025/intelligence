// app/api/run/route.ts
import { NextResponse } from "next/server";

type NormalizedItem = {
  title: string;
  type: string;
  source: string;
  snippet?: string;
  url?: string;
  rating?: number | null;
  date?: string | null;
};

const APIFY_BASE = "https://api.apify.com/v2";

// ✅ Actor IDs (Apify store)
// This one you already used successfully:
const ACTOR_GOOGLE_MAPS = "compass/crawler-google-places";

// Helper: safe JSON response (always JSON, even on errors)
function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// Helper: fetch JSON or throw readable error
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();

  // Try parse JSON
  try {
    const parsed = JSON.parse(text);
    if (!res.ok) {
      throw new Error(
        parsed?.error?.message ||
          parsed?.message ||
          parsed?.error ||
          `Request failed (${res.status})`
      );
    }
    return parsed;
  } catch {
    // Not JSON
    if (!res.ok) throw new Error(text || `Request failed (${res.status})`);
    // If OK but not JSON, still error (we expect JSON from Apify)
    throw new Error("Unexpected non-JSON response from upstream.");
  }
}

function normalizeGooglePlace(p: any): NormalizedItem {
  // The actor returns fields like title/name, placeId, address, website, totalScore, etc.
  const title = p?.title || p?.name || "Unknown";
  const rating =
    typeof p?.totalScore === "number"
      ? p.totalScore
      : typeof p?.rating === "number"
      ? p.rating
      : null;

  const url =
    p?.url ||
    p?.googleUrl ||
    p?.placeUrl ||
    (p?.placeId
      ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(
          p.placeId
        )}`
      : undefined);

  const snippetParts: string[] = [];
  if (p?.address) snippetParts.push(p.address);
  if (p?.phone) snippetParts.push(p.phone);
  if (p?.website) snippetParts.push(p.website);

  return {
    title,
    type: "business",
    source: "google-maps",
    snippet: snippetParts.join(" • "),
    url,
    rating,
    date: null,
  };
}

async function runApifyActorAndGetItems(params: {
  token: string;
  actorId: string;
  input: any;
  waitSeconds?: number;
  pollSeconds?: number;
}) {
  const { token, actorId, input } = params;
  const waitSeconds = params.waitSeconds ?? 30; // initial wait
  const pollSeconds = params.pollSeconds ?? 60; // max poll time

  // Start run (wait a bit)
  const runStartUrl = `${APIFY_BASE}/acts/${encodeURIComponent(
    actorId
  )}/runs?token=${encodeURIComponent(token)}&waitForFinish=${waitSeconds}`;

  const started = await fetchJson(runStartUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const runId = started?.data?.id;
  if (!runId) throw new Error("Apify: run id missing.");

  // Poll run until finished or timeout
  const deadline = Date.now() + pollSeconds * 1000;
  let run = started?.data;

  while (
    run &&
    run.status &&
    !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status) &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    const runUrl = `${APIFY_BASE}/actor-runs/${encodeURIComponent(
      runId
    )}?token=${encodeURIComponent(token)}`;
    const runResp = await fetchJson(runUrl);
    run = runResp?.data;
  }

  if (!run?.status) throw new Error("Apify: run status missing.");

  if (run.status !== "SUCCEEDED") {
    // include Apify details if present
    throw new Error(
      `Apify run ${run.status}${
        run?.statusMessage ? `: ${run.statusMessage}` : ""
      }`
    );
  }

  const datasetId = run?.defaultDatasetId;
  if (!datasetId) throw new Error("Could not find datasetId from Apify run.");

  // Fetch dataset items
  const itemsUrl = `${APIFY_BASE}/datasets/${encodeURIComponent(
    datasetId
  )}/items?token=${encodeURIComponent(token)}&clean=true&format=json`;

  const itemsRes = await fetch(itemsUrl);
  const itemsText = await itemsRes.text();

  try {
    const items = JSON.parse(itemsText);
    if (!Array.isArray(items)) {
      throw new Error("Dataset items response was not an array.");
    }
    return items;
  } catch {
    throw new Error("Failed to parse dataset items JSON.");
  }
}

export async function GET(req: Request) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return json({ items: [], error: "Missing APIFY_TOKEN" }, 500);

    const { searchParams } = new URL(req.url);
    const source = (searchParams.get("source") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    if (!source) return json({ items: [], error: "Missing source" }, 400);
    if (!q) return json({ items: [], error: "Missing q" }, 400);

    // ✅ Implemented: Google Maps places (business listing)
    if (source === "google-maps") {
      // Minimal input for compass/crawler-google-places
      // Keep it cheap and fast:
      const input = {
        searchStringsArray: [q],
        locationQuery: "Ireland",
        maxCrawledPlacesPerSearch: 10,
        // You can add:
        // language: "en",
        // maxReviews: 10,
      };

      const rawItems = await runApifyActorAndGetItems({
        token,
        actorId: ACTOR_GOOGLE_MAPS,
        input,
        waitSeconds: 30,
        pollSeconds: 90,
      });

      const normalized: NormalizedItem[] = rawItems.map(normalizeGooglePlace);

      return json({ items: normalized });
    }

    // ✅ Not wired yet (but stable)
    const notWired: NormalizedItem[] = [
      {
        title: `Source "${source}" not wired yet`,
        type: "info",
        source,
        snippet:
          "The UI is working. Next step is connecting this source to an Apify actor and mapping fields into the standard format.",
        url: "",
        rating: null,
        date: null,
      },
    ];

    return json({ items: notWired });
  } catch (e: any) {
    // Always return JSON
    return json(
      {
        items: [],
        error: e?.message || "Apify request failed",
        details: e?.stack ? String(e.stack).slice(0, 1000) : undefined,
      },
      500
    );
  }
}
