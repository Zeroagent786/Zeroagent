"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (/ChunkLoadError|Loading chunk|dynamically imported|module script/i.test(error.message + error.name)) {
      try {
        if (sessionStorage.getItem("zeroagent.chunkreload") !== "1") {
          sessionStorage.setItem("zeroagent.chunkreload", "1");
          window.location.reload();
        }
      } catch {}
    }
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#07080A", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>ZeroAgent hit a snag</h2>
          <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 420, wordBreak: "break-word" }}>{error.message || "Unexpected error"}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button onClick={() => window.location.reload()} style={{ height: 40, padding: "0 20px", borderRadius: 8, border: 0, background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" }}>Reload</button>
            <button onClick={reset} style={{ height: 40, padding: "0 20px", borderRadius: 8, border: "1px solid #444", background: "transparent", color: "#fff", cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
