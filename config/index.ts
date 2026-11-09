/**
 * Layer 1: configuration. The site URL comes from BASE_URL so the suite can run against
 * a staging copy; paths are relative and resolved against Playwright's `baseURL`.
 */
export const config = {
    baseURL: process.env.BASE_URL || 'https://sparklecartonline.com',

    paths: {
        home: '/',
        shopAll: '/collections/all',
        faqs: '/pages/faqs',
        trackOrder: '/pages/track-order',
        contact: '/pages/contact',
        cart: '/cart',
        search: '/search',
    },

    logLevel: (process.env.LOG_LEVEL || 'INFO').toUpperCase(),
} as const;
