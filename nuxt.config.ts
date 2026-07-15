// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  routeRules: {
    '/**': {
      headers: {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
        'cross-origin-opener-policy': 'same-origin',
        ...(process.env.NODE_ENV === 'production'
          ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' }
          : {})
      }
    }
  },

  future: {
    compatibilityVersion: 4
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint'
  ],

  icon: {
    serverBundle: 'local',
  },

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
    server: {
      allowedHosts: ['mis.bangkhan.com', 'localhost'],
    },
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
