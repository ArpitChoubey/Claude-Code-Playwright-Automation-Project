import { defineConfig, devices } from '@playwright/test';
import { config } from './config';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Site under test; override with BASE_URL. Page objects navigate with relative paths. */
    baseURL: config.baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot : 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* BROWSER_CHANNEL=msedge (or chrome) runs this project on an installed browser
       instead of Playwright's downloaded Chromium. */
    {
      name: 'chromium',
      testIgnore: ['**/resilience/**', '**/kafka/**'],
      use: { ...devices['Desktop Chrome'], channel: process.env.BROWSER_CHANNEL || undefined },
    },

    {
      name: 'firefox',
      testIgnore: ['**/resilience/**', '**/kafka/**'],
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testIgnore: ['**/resilience/**', '**/kafka/**'],
      use: { ...devices['Desktop Safari'] },
    },

    /* Chaos/resilience suite: needs a Kubernetes cluster with Chaos Mesh.
       Skipped unless CHAOS_* env vars are set (see utils/chaos/chaosConfig.ts).
       No retries: a retry would hide exactly the failures this suite looks for. */
    {
      name: 'chaos',
      testDir: './tests/resilience',
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },

    /* Kafka producer/consumer suite: no browser. Skipped if no broker answers at
       KAFKA_BROKERS (default localhost:9092); see utils/kafka/kafkaConfig.ts. */
    {
      name: 'kafka',
      testDir: './tests/kafka',
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
