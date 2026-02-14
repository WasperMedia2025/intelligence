"use client";

import React, { useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  type: string;
  source: string;
  snippet: string;
  url?: string;
  date?: string | null;
  rating?: number | null;
};

function safePreview(s: string, n = 180) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // If server returned HTML or plain text, show a helpful message
    throw new Error(`Server returned non-JSON: ${safePreview(text, 120)}`);
  }
}

export default function Page() {
  const [q, setQ] = useState("Grid Finance");

  // Only Google is wired right now (stable)
  const [source, setSource] = useState("google-maps");

  // Filters
  const [days, setDays] = useState("30");
  const [minRating, setMinRating] = useState("0");
  const [maxPlaces, setMaxPlaces] = useState("8");
  const [maxReviews, setMaxReviews] = useState("20");

  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const canRun = useMemo(() => q.trim().length > 0, [q]);

  async function pollRun(runId: string) {
    // Poll up to ~2 minutes (60 * 2s)
    for (let i = 0; i < 60; i++) {
      const pollUrl =
        `/api/run?source=${encodeURIComponent(source)}` +
        `&q=${encodeURIComponent(q.trim())}` +
        `&runId=${encodeURIComponent(runId)}` +
        `&days=${encodeURIComponent(days)}` +
        `&minRating=${encodeURIComponent(minRating)}`;

      const res = await fetch(pollUrl, { cache: "no-store" });
      const json = await safeJson(res);

      if (json?.status === "SUCCEEDED") {
        setItems(json.items || []);
        setStatusText(null);
        return;
      }

      setStatusText(`Running… (${json?.status || "WAITING"})`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error("Still running after 2 minutes. Try a smaller max places/reviews.");
  }

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);
    setStatusText("Starting…");

    try {
      if (!canRun) throw new Error("Enter a query first.");

      const startUrl =
        `/api/run?source=${encodeURIComponent(source)}` +
        `&q=${encodeURIComponent(q.trim())}` +
        `&days=${encodeURIComponent(days)}` +
        `&minRating=${encodeURIComponent(minRating)}` +
        `&maxPlaces=${encodeURIComponent(maxPlaces)}` +
        `&maxReviews=${encodeURIComponent(maxReviews)}`;

      const startRes = await fetch(startUrl, { cache: "no-store" });
      const startJson = await safeJson(startRes);

      if (startJson?.error) throw new Error(startJson.error);

      if (startJson?.status === "SUCCEEDED") {
        setItems(startJson.items || []);
        setStatusText(null);
        return;
      }

      if (startJson?.status === "RUNNING" && startJson?.runId) {
        setStatusText("Running…");
        await pollRun(startJson.runId);
        return;
      }

      throw new Error("Unexpected response from API.");
    } catch (e: any) {
      setError(e?.message || "Failed");
      setStatusText(null);
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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search query (e.g. Grid Finance)"
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="google-maps">Google (business + reviews)</option>
        </select>

        <select
          value={days}
          onChange={(e) => setDays(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
          title="Review date range"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="0">All time</option>
        </select>

        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
          title="Minimum star rating"
        >
          <option value="0">Any rating</option>
          <option value="3">3★+</option>
          <option value="4">4★+</option>
          <option value="5">5★ only</option>
        </select>

        <input
          value={maxPlaces}
          onChange={(e) => setMaxPlaces(e.target.value)}
          style={{
            width: 120,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
          placeholder="Max places"
          title="Max places per search (lower = faster)"
        />

        <input
          value={maxReviews}
          onChange={(e) => setMaxReviews(e.target.value)}
          style={{
            width: 140,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
          }}
          placeholder="Max reviews"
          title="Max reviews per place (lower = faster)"
        />

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {statusText && (
        <p style={{ marginTop: 12, opacity: 0.8 }}>{statusText}</p>
      )}

      {error && (
        <p style={{ marginTop: 12, color: "#ff6b6b" }}>
          Error: {error}
        </p>
      )}

      <h2 style={{ marginTop: 18, fontSize: 18 }}>Results</h2>

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
            gridTemplateColumns: "2fr 1fr 1fr 3fr 1fr",
            gap: 0,
            padding: 12,
            background: "rgba(255,255,255,0.06)",
            fontWeight: 700,
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
          items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 3fr 1fr",
                padding: 12,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                alignItems: "start",
              }}
            >
              <div style={{ fontWeight: 650 }}>
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
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    {String(it.date)}
                  </div>
                ) : null}
              </div>
              <div style={{ opacity: 0.85 }}>{it.type}</div>
              <div style={{ opacity: 0.85 }}>{it.source}</div>
              <div style={{ opacity: 0.85 }}>{safePreview(it.snippet)}</div>
              <div style={{ opacity: 0.85 }}>
                {it.rating != null ? `${it.rating}★` : ""}
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
        Tip: If it’s slow, reduce “Max places” and “Max reviews”.
      </p>

      <style jsx global>{`
        body {
          background: #0b0b0f;
          color: white;
        }
      `}</style>
    </main>
  );
}
