import { readFileSync, writeFileSync } from "node:fs";

// vinext emits the actual bundle and asset path in this generated config.
// Keep its build paths while applying the isolated, closed Cloudflare settings.
const generatedPath = new URL("../dist/server/wrangler.json", import.meta.url);
const previewPath = new URL("../wrangler.uat.jsonc", import.meta.url);
const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
const preview = JSON.parse(readFileSync(previewPath, "utf8"));
const { $schema, ...settings } = preview;
void $schema;

const config = {
  ...generated,
  ...settings,
  main: generated.main,
  assets: { ...generated.assets, ...settings.assets, directory: generated.assets.directory },
  d1_databases: [],
};
writeFileSync(generatedPath, JSON.stringify(config, null, 2) + "\n");
console.log("Prepared isolated fictional UAT bundle with no D1 binding or public route.");
