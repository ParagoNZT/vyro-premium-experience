import { defineNitroConfig } from "nitro/config";

const id = process.env["VYRO_D1_DATABASE_ID"]?.trim();
const name = process.env["VYRO_D1_DATABASE_NAME"]?.trim();
const releases = process.env["VYRO_R2_RELEASES_BUCKET"]?.trim();

if (id && (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !name)) {
  throw new Error("VYRO_D1_DATABASE_ID must be a UUID and requires VYRO_D1_DATABASE_NAME.");
}

export default defineNitroConfig({
  // Leave the Lovable-selected preset and generated worker name unchanged.
  cloudflare: {
    wrangler: {
      ...(id && name
        ? { d1_databases: [{ binding: "VYRO_DB", database_id: id, database_name: name }] }
        : {}),
      ...(releases ? { r2_buckets: [{ binding: "VYRO_RELEASES", bucket_name: releases }] } : {}),
    },
  },
});
