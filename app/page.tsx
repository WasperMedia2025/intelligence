// app/page.tsx
"use client";

import React, { useMemo, useState } from "react";

type Item = {
  title: string;
  type: string;
  source: string;
  snippet?: string;
  url?: string;
  rating?: number | null;
  date?: string | null;
};

const SOURCES = [
  { value: "google-maps", label: "Google (business + reviews)" },
  { value: "reddit", label: "Reddit (conversations)" },
  { value: "quora", label: "Quora (questions)" },
  { value: "trustpilot", label: "Trustpilot (reviews)" },
  { value: "trends", label: "Google Trends (Ireland)" },
];

export default function Page() {
  const [q, setQ] = useState("Grid Finance");
  const [source, setSource] = useState("google-maps");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sourceLabel = useMemo(() => {
    return SOURCES.find((s) => s.value === source)?.label || source;
  }, [source]);

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const res = await fetch(
        `/api/run?source=${encodeURIComponent(source)}&q=${encodeURIComponent(q)}`,
        { method: "GET" }
      );

      // Safest approach: read text first, then parse JSON
      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON: ${text.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      if (!Array.isArray(data?.items)) {
        setError("Response was OK but items were missing.");
      }
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
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search query (e.g. Grid Finance)"
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: "white",
          }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.03)",
            color: "white",
          }}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, color: "#ff6b6b" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <h2 style={{ marginTop: 22, fontSize: 18 }}>Results</h2>

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
            gridTemplateColumns: "2fr 1fr 1fr 3fr",
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
        </div>

        {items.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.7 }}>
            No results yet. Run a query for <em>{sourceLabel}</em>.
          </div>
        ) : (
          items.map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 3fr",
                padding: "10px 12px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ paddingRight: 8 }}>
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
                {typeof it.rating === "number" && (
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2 }}>
                    Rating: {it.rating}
                  </div>
                )}
              </div>
              <div>{it.type}</div>
              <div>{it.source}</div>
              <div style={{ opacity: 0.85 }}>{it.snippet || ""}</div>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
        Next: we standardise output from each source into: title, type, source,
        snippet, url, date, rating (if review).
      </p>

      <style jsx global>{`
        html,
        body {
          background: #0b0b0c;
          color: white;
        }
      `}</style>
    </main>
  );
}
