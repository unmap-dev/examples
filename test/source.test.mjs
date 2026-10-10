import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const catalog = JSON.parse(readFileSync("catalog.json", "utf8"));
const provenance = JSON.parse(readFileSync("test/fixtures/provenance.json", "utf8"));
test("every catalog entry has runnable source and its docs link", () => {
  assert(catalog.length > 0);
  const unique = new Set();
  for (const entry of catalog) {
    assert(!unique.has(`${entry.lane}/${entry.slug}`));
    unique.add(`${entry.lane}/${entry.slug}`);
    assert(existsSync(entry.route), entry.route);
    assert.match(entry.docs, /^https:\/\/unmap\.dev\/(?:docs|templates)\//);
  }
  for (const entry of catalog.filter((entry) => entry.lane === "typescript")) {
    assert(existsSync(join("sdk/examples", entry.slug, "index.html")));
    assert(existsSync(join("sdk/examples", entry.slug, "snippet.ts.txt")));
  }
});
test("copied components and attributed data match the exported upstream snapshot", () => {
  assert(Object.keys(provenance).length > 0);
  for (const [file, expected] of Object.entries(provenance)) {
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), expected.sha256, file);
  }
});
test("HTML downloads include both languages, editable GeoJSON, and a key placeholder", () => {
  for (const slug of readdirSync("html", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    for (const lang of ["en", "fr"]) {
      assert.match(readFileSync(`html/${slug}/${lang}.html`, "utf8"), /YOUR_UNMAP_API_KEY/);
      assert.equal(JSON.parse(readFileSync(`html/${slug}/${lang}.geojson`, "utf8")).type, "FeatureCollection");
    }
  }
});
