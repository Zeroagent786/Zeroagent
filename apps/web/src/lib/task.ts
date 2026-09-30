/** Task descriptions travel on-chain as a data: URI so no IPFS pinning is required for the MVP. */
export type TaskMeta = { title: string; description: string; verify: string[] };

export function encodeTask(meta: TaskMeta): string {
  const json = JSON.stringify(meta);
  const b64 = typeof window === "undefined" ? Buffer.from(json).toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${b64}`;
}

export function decodeTask(uri: string): TaskMeta {
  const prefix = "data:application/json;base64,";
  if (uri.startsWith(prefix)) {
    try {
      const json = decodeURIComponent(escape(atob(uri.slice(prefix.length))));
      const m = JSON.parse(json) as Partial<TaskMeta>;
      return { title: m.title || "Untitled task", description: m.description || "", verify: m.verify ?? [] };
    } catch {
      /* fall through */
    }
  }
  return { title: uri.length > 40 ? uri.slice(0, 37) + "…" : uri || "Untitled task", description: uri, verify: [] };
}
