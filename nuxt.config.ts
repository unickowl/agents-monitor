// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  nitro: {
    experimental: { wasm: false },
  },
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
  },
})
