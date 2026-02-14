"use client";

import React, { useMemo, useState } from "react";

type Source = "google-maps" | "reddit" | "quora" | "trustpilot" | "trends";

type Item = {
  title: string;
  type: string;
  source: string;
  snippet: string;
  url?: string;
  rating?: number | null;
  date?: string | null;
};

function isWithinDays(dateStr: string | null | undefined, days: number) {
  if (!days || days <= 0) return true;
  if (!dateStr) return true; // if no date provided by actor, don't hide it
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

export default function Page() {
  const [q, setQ] = useState("Grid Finance");
  const [source, setSource] = useState<Source>("google-maps");

  // Filters (client-side, so they cannot break scraping)
  const [rangeDays, setRangeDays] = useState<number>(30); // 7/30/90
  const [minRating, setMinRating] = useState<number>(0); // 0 = any

  // Scrape limits (these affect Apify runtime/cost)
  const [maxPlaces, setMaxPlaces] = useState<number>(3);
  const [maxReviews, setMaxReviews] = useState<number>(10);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<{ placesFetched: number; reviewsFetched: number } | null>(null);

  async function safeJson(res: Response) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server returned a non-JSON response.");
    }
  }

  const shownItems = useMemo(() => {
    return (items || []).filter((it) => {
      if (it.type === "review") {
        // rating filter
        if (minRating && (it.rating ?? 0) < minRating) return false;
        // date filter (only if date exists)
        if (!isWithinDays(it.date, rangeDays)) return false;
      }
      return true;
    });
  }, [items, minRating, rangeDays]);

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);
    setMeta(null);
    setStatus("Starting…");

    try {
      // 1) Start run (receipt)
      const startRes = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          source,
          maxPlaces,
          maxReviews,
        }),
      });

      const startJson = await safeJson(startRes);

      if (!startRes.ok) {
        throw new Error(startJson?.error || "Failed to start run");
      }

      const runId = startJson?.runId;
      if (!runId) throw new Error("No runId returned from server");

      // 2) Poll results until done
      setStatus("RUNNING");
      const maxAttempts = 90; // 90 * 2s = 3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const pollRes = await fetch(
          `/api/results?runId=${encodeURIComponent(runId)}&maxReviews=${encodeURIComponent(String(maxReviews))}`
        );
        const pollJson = await safeJson(pollRes);

        if (!pollRes.ok) {
          throw new Error(pollJson?.error || "Polling failed");
        }

        const st = pollJson?.status || "";
        setStatus(st);

        if (st === "SUCCEEDED") {
          const fetchedItems: Item[] = Array.isArray(pollJson?.items) ? pollJson.items : [];
          setItems(fetchedItems);

          const m = pollJson?.meta;
          if (m && typeof m === "object") {
            setMeta({
              placesFetched: Number(m.placesFetched || 0),
              reviewsFetched: Number(m.reviewsFetched || 0),
            });
          } else {
            setMeta({ placesFetched: 0, reviewsFetched: 0 });
          }

          setStatus("DONE");
          setLoading(false);
          return;
        }
      }

      throw new Error("Timed out waiting for results. Reduce max places/reviews.");
    } catch (e: any) {
      setError(e?.message || "Failed");
      setStatus("");
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", background: "#0b0b0f", minHeight: "100vh", color: "white" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Wasper Intelligence</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Current build stabilises Google Reviews first. Reddit/Quora/Trustpilot/Trends will be plugged in after this is solid.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. Grid Finance"
          style={{ padding: "10px 12px", borderRadius: 10, width: 360, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
        >
          <option value="google-maps">Google (reviews)</option>
          <option value="reddit">Reddit (coming next)</option>
          <option value="quora">Quora (coming next)</option>
          <option value="trustpilot">Trustpilot (coming next)</option>
          <option value="trends">Google Trends (coming next)</option>
        </select>

        {/* Filters (client-side only) */}
        <select
          value={String(rangeDays)}
          onChange={(e) => setRangeDays(Number(e.target.value))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="0">All time</option>
        </select>

        <select
          value={String(minRating)}
          onChange={(e) => setMinRating(Number(e.target.value))}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
        >
          <option value="0">Any rating</option>
          <option value="3">3★+</option>
          <option value="4">4★+</option>
          <option value="5">5★ only</option>
        </select>

        {/* Scrape limits */}
        <input
          type="number"
          value={maxPlaces}
          onChange={(e) => setMaxPlaces(Number(e.target.value))}
          min={1}
          max={20}
          style={{ padding: "10px 12px", borderRadius: 10, width: 120, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
          title="Max places (keep small to avoid slow runs)"
        />

        <input
          type="number"
          value={maxReviews}
          onChange={(e) => setMaxReviews(Number(e.target.value))}
          min={1}
          max={50}
          style={{ padding: "10px 12px", borderRadius: 10, width: 140, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white" }}
          title="Max reviews per place"
        />

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      <div style={{ marginTop: 12, opacity: 0.85, fontSize: 13 }}>
        Status: <b>{status || "—"}</b>
        {" • "}
        Fetched:{" "}
        <b>
          {meta ? `${meta.reviewsFetched} reviews across ${meta.placesFetched} places` : "—"}
        </b>
        {" • "}
        Shown after filters: <b>{shownItems.filter((i) => i.type === "review").length} reviews</b>
      </div>

      {error && (
        <div style={{ marginTop: 14, color: "#ff6b6b", fontWeight: 700 }}>
          Error: {error}
        </div>
      )}

      <h2 style={{ marginTop: 18 }}>Results</h2>

      {shownItems.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No results yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {shownItems.slice(0, 80).map((it, i) => (
            <div key={i} style={{ padding: 12, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontWeight: 800 }}>
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noreferrer" style={{ color: "white" }}>
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
                {it.rating != null ? ` (${it.rating}★)` : ""}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                {it.source} • {it.type} {it.date ? `• ${it.date}` : ""}
              </div>
              <div style={{ marginTop: 8, opacity: 0.9 }}>{it.snippet}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, opacity: 0.6, fontSize: 12 }}>
        Tip: If it’s slow, reduce <b>Max places</b> and <b>Max reviews</b>. Filters never break scraping because they’re applied client-side only.
      </div>
    </main>
  );
}
