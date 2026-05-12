// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  future: {
    compatibilityVersion: 4
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint'
  ],

  ui: {
    colors: {
      primary: 'blue'
    }
  },

  nitro: {
    experimental: {
      openAPI: true
    }
  },



  colorMode: {
    preference: 'light'
  },

  vite: {
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
    }
  },

  hooks: {
    'vite:extendConfig'(config) {
      if (process.env.NODE_ENV === 'production') {
        config.build = config.build || {}
        config.build.minify = 'terser'
        config.build.terserOptions = {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
        }
      }
    }
  }
})
