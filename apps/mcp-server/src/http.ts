import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./tools.js";

const app = express();
app.use(express.json());

// CORS so the web playground / browser tools can reach the server.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id, mcp-protocol-version, accept");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => void res.json({ ok: true, name: "zero-agent-mcp" }));

// Stateless Streamable HTTP: a fresh server + transport per request.
app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
  }
});

const notAllowed = (_req: express.Request, res: express.Response) =>
  void res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
app.get("/mcp", notAllowed);
app.delete("/mcp", notAllowed);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.error(`zero-agent MCP (streamable http) listening on :${port}/mcp`));
