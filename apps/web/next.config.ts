import type { NextConfig } from "next";
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

// During dev mode, simulate Cloudflare bindings locally
if (process.env.NODE_ENV === "development") {
  (async () => {
    await setupDevPlatform();
  })();
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
