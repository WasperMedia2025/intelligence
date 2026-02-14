"use client";

import React, { useState } from "react";

type Item = {
  title: string;
  type: string;
  source: string;
  snippet: string;
  url?: string;
  date?: string;
  rating?: number | null;
};

export default function Page() {
  const [q, setQ] = useState("Grid Finance");
  const [source, setSource] = useState("google-maps");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const res = await fetch(
        `/api/run?source=${encodeURIComponent(source)}&q=${encodeURIComponent(q)}`,
        { method: "GET" }
      );

      // Some failures return non-JSON (plain text). Handle both safely.
      let data: any = null;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        color: "white",
        background: "#0b0b0f",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        Wasper Intelligence
      </h1>

      <p style={{ opacity: 0.75, marginTop: 0, marginBottom: 18 }}>
        Internal research engine for reviews + conversations (Google, Reddit, Trustpilot, Quora, Trends).
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", maxWidth: 980 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. Grid Finance / NuSolas / The Flame"
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            outline: "none",
          }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{
            width: 240,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "white",
            outline: "none",
          }}
        >
          <option value="google-maps">Google (business + reviews)</option>
          <option value="trustpilot">Trustpilot (reviews)</option>
          <option value="reddit">Reddit (discussions)</option>
          <option value="quora">Quora (questions)</option>
          <option value="trends">Google Trends (Ireland)</option>
        </select>

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
            minWidth: 110,
          }}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "#ff4d4f", marginTop: 14 }}>{`Error: ${error}`}</p>
      ) : null}

      <h2 style={{ marginTop: 22, marginBottom: 10, fontSize: 18 }}>Results</h2>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1fr 1.2fr 3fr",
            gap: 0,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.04)",
            fontWeight: 700,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div>Title</div>
          <div>Type</div>
          <div>Source</div>
          <div>Snippet</div>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: "14px", opacity: 0.7 }}>No results yet. Run a query.</div>
        ) : (
          items.map((it, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1fr 1.2fr 3fr",
                padding: "12px 14px",
                borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                gap: 0,
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
              </div>
              <div style={{ opacity: 0.85 }}>{it.type}</div>
              <div style={{ opacity: 0.85 }}>{it.source}</div>
              <div style={{ opacity: 0.8 }}>{it.snippet}</div>
            </div>
          ))
        )}
      </div>

      <p style={{ opacity: 0.6, marginTop: 12, fontSize: 13 }}>
        Next: we’ll standardise output from each source into: title, type, source, snippet, url, date, rating (if review).
      </p>
    </main>
  );
}
