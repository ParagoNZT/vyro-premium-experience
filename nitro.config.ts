import { defineNitroConfig } from "nitro/config";
export default defineNitroConfig({
  preset: "cloudflare-module",
  cloudflare: { wrangler: {
    name: "vyro-premium-experience",
    d1_databases: [{ binding: "VYRO_DB", database_name: "vyro-management", database_id: "bcf2588f-d55e-4ae0-b0b7-792620795132", jurisdiction: "eu" }],
  } },
});
