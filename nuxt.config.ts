import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
const isProduction = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxt/image',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt',
    'pinia-plugin-persistedstate/nuxt',
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    public: {
      r2PublicUrl: process.env.R2_PUBLIC_URL || '',
      appName: 'Malaz Scans',
    },
  },

  pinia: {
    storesDirs: ['./app/stores/**'],
  },

  image: {
    provider: 'ipx',
    quality: 100, // Non-destructive quality as per requirements
    format: ['webp', 'avif', 'png', 'jpg'], // Allow all formats natively
  },

  supabase: {
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/confirm',
      exclude: [
        '/',
        '/auth/login',
        '/auth/register',
        '/auth/confirm',
        '/auth/**',
        '/novels',
        '/novels/*',
        '/read/*',
        '/community',
        '/community/*',
      ],
    },
    redirect: false, // Disables built-in middleware to avoid conflicting with auth.global.ts
  },

  pwa: isProduction ? {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Malaz Scans — Light Novel Platform',
      short_name: 'Malaz Scans',
      description: 'A premium Light Novel reading platform with curated design.',
      theme_color: '#F9F9F7',
      background_color: '#F9F9F7',
      display: 'standalone',
      orientation: 'portrait-primary',
      icons: [
        { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: undefined,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  } : {
    devOptions: {
      enabled: false,
    },
  },

  routeRules: {
    '/': { swr: 3600 },
    '/novels': { swr: 3600 },
    '/novels/**': { swr: 3600 },
    '/api/novels': { swr: 300 },
    '/api/novels/featured': { swr: 300 },
    '/admin/**': { ssr: false },
    '/read/**': { ssr: false },
  },

  nitro: {
    storage: {
      cache: {
        driver: 'memory',
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Malaz Scans — Light Novel Platform',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A premium Light Novel reading platform featuring minimalist design, curated translations, and immersive reading experience.' },
        { name: 'theme-color', content: '#F9F9F7' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Malaz Scans' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Lora:ital,wght@0,400..700;1,400..700&family=Inter:wght@300..800&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    },
  },
})