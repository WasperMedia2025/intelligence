"use client";

import { useState } from "react";

type ResultItem = Record<string, any>;

export default function Home() {
  const [query, setQuery] = useState("Grid Finance");
  const [source, setSource] = useState("google-maps");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const res = await fetch(`/api/run?source=${encodeURIComponent(source)}&q=${encodeURIComponent(query)}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Something went wrong");

      // We’ll standardise to { items: [...] } in every endpoint
      setItems(json.items || []);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Wasper Intelligence</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        Internal research engine for reviews + conversations (Google, Reddit, Trustpilot, Quora, Trends).
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search e.g. Grid Finance / heat pumps / mortgage broker Dublin"
          style={{ padding: 10, minWidth: 360, borderRadius: 10, border: "1px solid #333" }}
        />

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #333" }}
        >
          <option value="google-maps">Google (business + reviews)</option>
          <option value="reddit">Reddit (posts + questions)</option>
          <option value="trustpilot">Trustpilot (reviews)</option>
          <option value="quora">Quora (questions)</option>
          <option value="trends">Google Trends (Ireland)</option>
        </select>

        <button
          onClick={run}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, color: "tomato" }}>
          Error: {error}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Results</h2>

        <div style={{ marginTop: 10, border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#111" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #333" }}>Title</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #333" }}>Type</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #333" }}>Source</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #333" }}>Snippet</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 12, opacity: 0.6 }}>
                    No results yet. Run a query.
                  </td>
                </tr>
              )}

              {items.map((item, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #222" }}>
                  <td style={{ padding: 10 }}>{item.title || item.name || "-"}</td>
                  <td style={{ padding: 10 }}>{item.type || "-"}</td>
                  <td style={{ padding: 10 }}>{item.source || source}</td>
                  <td style={{ padding: 10, opacity: 0.8 }}>{item.snippet || item.text?.slice?.(0, 140) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
          Next: we’ll standardise output from each source into: title, type, source, snippet, url, date, rating (if review).
        </p>
      </div>
    </main>
  );
}
