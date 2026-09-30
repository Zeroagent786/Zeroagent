"use client";

import Link from "next/link";
import { useEffect } from "react";

const CHUNK = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported|Importing a module script failed/i;

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // A redeploy replaces JS files; an old open tab then fails to load them. One automatic reload fixes it.
    if (CHUNK.test(error.message + error.name)) {
      try {
        if (sessionStorage.getItem("zeroagent.chunkreload") !== "1") {
          sessionStorage.setItem("zeroagent.chunkreload", "1");
          window.location.reload();
          return;
        }
      } catch {}
    }
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-subtle text-xl">⚠️</div>
      <h2 className="text-lg font-semibold tracking-tight">Something went wrong on this page</h2>
      <p className="mt-2 max-w-md break-words text-sm text-muted">{error.message || "Unexpected error"}</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="h-10 rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-[#27272A]">Try again</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-5 text-sm font-medium hover:bg-subtle">Back to start</Link>
      </div>
    </div>
  );
}
