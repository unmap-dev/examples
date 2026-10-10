import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readdirSync } from "node:fs";
export default defineConfig({ build: { rollupOptions: { input: [resolve("index.html"), ...readdirSync("examples").map((slug) => resolve("examples", slug, "index.html"))] } } });
