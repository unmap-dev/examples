export default defineNuxtConfig({
  compatibilityDate: "2026-10-10",
  ssr: false,
  components: false,
  css: ["~/assets/globals.css"],
  runtimeConfig: { public: { unmapKey: "" } },
  postcss: { plugins: { "@tailwindcss/postcss": {} } },
  typescript: { strict: true },
});
