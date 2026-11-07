import { defineNitroConfig } from "nitro/config";

// Cloudflare shares build variables across branches. Never give a preview
// access to the production database or release bucket.
const useConfiguredBindings =
  process.env["WORKERS_CI"] !== "1" || process.env["WORKERS_CI_BRANCH"] === "main";
const id = useConfiguredBindings ? process.env["VYRO_D1_DATABASE_ID"]?.trim() : undefined;
const name = useConfiguredBindings ? process.env["VYRO_D1_DATABASE_NAME"]?.trim() : undefined;
const releases = useConfiguredBindings ? process.env["VYRO_R2_RELEASES_BUCKET"]?.trim() : undefined;

if (id && (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !name)) {
  throw new Error("VYRO_D1_DATABASE_ID must be a UUID and requires VYRO_D1_DATABASE_NAME.");
}

export default defineNitroConfig({
  // Leave the Lovable-selected preset and generated worker name unchanged.
  cloudflare: {
    wrangler: {
      keep_vars: true,
      ...(id && name
        ? { d1_databases: [{ binding: "VYRO_DB", database_id: id, database_name: name }] }
        : {}),
      ...(releases ? { r2_buckets: [{ binding: "VYRO_RELEASES", bucket_name: releases }] } : {}),
    },
  },
});
