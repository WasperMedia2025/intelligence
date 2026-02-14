"use client";

import React, { useMemo, useState } from "react";

type Source = "google-maps" | "reddit" | "quora" | "trustpilot" | "trends";

type Item = {
  title: string;
  type: string;
  source: string;
  snippet: string;
  url?: string;
  date?: string | null;
  rating?: number | null;
  meta?: any;
};

export default function Page() {
  const [q, setQ] = useState("Grid Finance");
  const [source, setSource] = useState<Source>("google-maps");

  // Filters
  const [dateRangeDays, setDateRangeDays] = useState<number>(30); // 0 = all
  const [minRating, setMinRating] = useState<number>(0); // 0 = any
  const [maxPlaces, setMaxPlaces] = useState<number>(3);
  const [maxReviews, setMaxReviews] = useState<number>(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const canUseFilters = source === "google-maps";

  const dateLabel = useMemo(() => {
    if (!dateRangeDays) return "All time";
    if (dateRangeDays === 7) return "Last 7 days";
    if (dateRangeDays === 30) return "Last 30 days";
    if (dateRangeDays === 90) return "Last 90 days";
    return `Last ${dateRangeDays} days`;
  }, [dateRangeDays]);

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          source,
          dateRangeDays: canUseFilters ? dateRangeDays : 0,
          minRating: canUseFilters ? minRating : 0,
          maxPlaces: canUseFilters ? maxPlaces : 3,
          maxReviews: canUseFilters ? maxReviews : 10,
        }),
      });

      const text = await res.text();

      // Always guard JSON parsing (prevents “Unexpected token …”)
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(text || "Server returned a non-JSON response.");
      }

      if (!res.ok) {
        throw new Error(json?.details || json?.error || "Request failed");
      }

      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>
        Wasper Intelligence
      </h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Internal research engine for reviews + conversations (Google, Reddit,
        Trustpilot, Quora, Trends).
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search term (e.g. Grid Finance / NuSolas / The Flame)"
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: "white",
            outline: "none",
          }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="google-maps">Google (business + reviews)</option>
          <option value="reddit">Reddit (threads)</option>
          <option value="quora">Quora (questions)</option>
          <option value="trustpilot">Trustpilot (reviews)</option>
          <option value="trends">Google Trends (Ireland)</option>
        </select>

        <select
          value={dateRangeDays}
          onChange={(e) => setDateRangeDays(Number(e.target.value))}
          disabled={!canUseFilters}
          title={!canUseFilters ? "Only enabled for Google in this build" : ""}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: canUseFilters ? "white" : "rgba(255,255,255,0.4)",
            outline: "none",
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={0}>All time</option>
        </select>

        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          disabled={!canUseFilters}
          title={!canUseFilters ? "Only enabled for Google in this build" : ""}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: canUseFilters ? "white" : "rgba(255,255,255,0.4)",
            outline: "none",
          }}
        >
          <option value={0}>Any rating</option>
          <option value={5}>5★ only</option>
          <option value={4}>4★ and up</option>
          <option value={3}>3★ and up</option>
          <option value={2}>2★ and up</option>
          <option value={1}>1★ and up</option>
        </select>

        <input
          type="number"
          value={maxPlaces}
          onChange={(e) => setMaxPlaces(Number(e.target.value))}
          disabled={!canUseFilters}
          min={1}
          max={8}
          title="Keep small so runs finish quickly"
          style={{
            width: 90,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: canUseFilters ? "white" : "rgba(255,255,255,0.4)",
            outline: "none",
          }}
        />

        <input
          type="number"
          value={maxReviews}
          onChange={(e) => setMaxReviews(Number(e.target.value))}
          disabled={!canUseFilters}
          min={0}
          max={30}
          title="Reviews per place"
          style={{
            width: 90,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: canUseFilters ? "white" : "rgba(255,255,255,0.4)",
            outline: "none",
          }}
        />

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: loading ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
        {source === "google-maps" ? (
          <>
            Filters active: <b>{dateLabel}</b>,{" "}
            <b>{minRating ? `${minRating}★+` : "any rating"}</b>,{" "}
            <b>{maxPlaces}</b> places, <b>{maxReviews}</b> reviews/place.
            <div style={{ marginTop: 6 }}>
              Tip: If it’s slow, reduce <b>Max places</b> and <b>Max reviews</b>.
            </div>
          </>
        ) : (
          <>This source is not wired yet in this build.</>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 14, color: "#ff6b6b" }}>
          <b>Error:</b> {error}
        </div>
      )}

      <h2 style={{ marginTop: 20, fontSize: 18 }}>Results</h2>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 0.9fr 1fr 2.5fr 0.6fr",
            gap: 0,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.04)",
            fontWeight: 600,
          }}
        >
          <div>Title</div>
          <div>Type</div>
          <div>Source</div>
          <div>Snippet</div>
          <div>Rating</div>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>
            No results yet. Run a query.
          </div>
        ) : (
          items.slice(0, 200).map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.9fr 1fr 2.5fr 0.6fr",
                padding: "10px 12px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                gap: 0,
                alignItems: "start",
              }}
            >
              <div style={{ paddingRight: 10 }}>
                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "white", textDecoration: "underline" }}
                  >
                    {it.title}
                  </a>
                ) : (
                  it.title
                )}
                {it.date ? (
                  <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>
                    {new Date(it.date).toLocaleString()}
                  </div>
                ) : null}
              </div>
              <div style={{ opacity: 0.85 }}>{it.type}</div>
              <div style={{ opacity: 0.85 }}>{it.source}</div>
              <div style={{ opacity: 0.8, whiteSpace: "pre-wrap" }}>
                {it.snippet}
              </div>
              <div style={{ opacity: 0.9 }}>
                {it.rating != null ? it.rating : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
