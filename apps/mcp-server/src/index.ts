import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";

createServer()
  .connect(new StdioServerTransport())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
