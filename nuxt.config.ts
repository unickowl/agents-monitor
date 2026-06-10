// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  devServer: {
    host: '0.0.0.0',
    port: 3030,
  },
  nitro: {
    experimental: { wasm: false },
  },
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
  },
})
