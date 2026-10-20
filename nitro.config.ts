import { defineNitroConfig } from "nitro/config";
export default defineNitroConfig({
  preset: "cloudflare-module",
  cloudflare: { wrangler: {
    name: "vyro-premium-experience",
    d1_databases: [{ binding: "VYRO_DB", database_name: "vyro-beta-access", database_id: "62609516-d269-4ced-a3c5-1acc6d9d5d2a" }],
  } },
});
