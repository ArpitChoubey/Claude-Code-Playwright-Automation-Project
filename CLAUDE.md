# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Playwright + TypeScript test framework with three independent suites:

1. **Browser UI tests** (`tests/*.spec.ts`) against the live **Sparkle Cart** store (https://sparklecartonline.com/). It's a Shopify store on the Dawn theme. No app code lives here, and results depend on the live site's content and markup.
2. **Kafka producer/consumer tests** (`tests/kafka/`). They need a broker.
3. **Kubernetes chaos/resilience tests** (`tests/resilience/`). They need a cluster running Chaos Mesh.

The README documents setup, every environment variable and how to run each suite.

## Commands

```bash
npm install
npx playwright install                     # browsers (CI uses --with-deps)
npm run typecheck                          # tsc -p . (strict); Playwright itself does not type-check

npm test                                   # all projects (kafka/chaos skip themselves without infra)
npx playwright test --project=chromium     # browser UI tests on one browser
npx playwright test tests/search.spec.ts   # one file
npx playwright test -g "Search with valid product"   # one test by title
BROWSER_CHANNEL=msedge npx playwright test --project=chromium   # use installed Edge/Chrome

npm run test:smoke | test:sanity | test:regression | test:e2e   # tag subsets via --grep
npm run test:kafka                         # needs a broker at KAFKA_BROKERS
npm run test:chaos                         # needs CHAOS_* env vars + a cluster
npm run allure:generate && npm run allure:open
```

## Architecture (browser UI suite)

The layers follow the `playwright-advance-e2e` skill: **test → fixture → module → page → browser**.

- **`config/index.ts`**: the `baseURL` (from `BASE_URL`) and site paths. `playwright.config.ts` sets `use.baseURL` from it, so pages navigate with relative paths. Never hardcode the site URL.
- **`pages/`**: locators as arrow functions plus single UI actions. No assertions and no branching. `BasePage` holds the header (nav, search, cart), because every page has it. Barrel export in `pages/index.ts`.
- **`modules/`**: business steps and their assertions (`searchFor`, `addCurrentProductToCart`, `verifyCartContains`). Modules use page methods and locators, never `page.locator()` directly. They log through `utils/Logger.ts`, never `console.log`.
- **`fixtures/index.ts`**: provides every page and module to tests. Tests import `{ test, expect }` from `@fixtures` and never call `new SomePage(page)`.
- **`tests/*.spec.ts`**: each action is wrapped in `test.step()`, and each test sets up its own state in `beforeEach`. No shared `page` between tests.
- **Path aliases** from `tsconfig.json`: `@config`, `@pages/*`, `@modules/*`, `@fixtures`, `@utils/*`, `@testdata/*`. Playwright resolves them at runtime.

### Locators and waits

- **Locator order:** prefer `getByRole` / `getByLabel` / `getByText`, then CSS as a last resort, with a comment saying why.
- **Header nav links:** scope them to `getByRole('banner').getByRole('navigation')`, because the page also has a "Home" collection card that a bare text match would hit.
- **Header search:** it sits behind a `<summary aria-label="Search">` toggle, so open it before filling the search box.
- **Product cards:** they are `#MainContent .product-card-wrapper`. Don't use a plain `.card`, which also matches collection cards.
- **Add to cart:** it's an AJAX `POST /cart/add`. `ProductPage.clickAddToCart()` waits for that response.
- **Fixed waits:** never use `waitForTimeout`; wait for a response, URL, or locator state instead.
- **Track Order widget:** it's a 17TRACK widget. An empty submit raises a browser `alert` ("Enter the tracking number."), and a submitted number shows nothing on the page. Capture alerts with a `page.once('dialog')` handler that dismisses them: a `waitForEvent('dialog')` listener stops Playwright's auto-dismiss, and the click then hangs.

### Test data

`TestData/*.json` is read through `utils/DataProvider.ts`, with paths relative to the repo root, so tests must run from the root. Random data comes from `utils/RandomDataGenerator.ts` (faker).

## Kafka and chaos suites

- **Kafka:** the `kafka` project, with no browser. `tests/kafka/kafkaFixture.ts` gives each test unique topics and consumer groups and deletes them afterwards. It checks the broker once per worker: unreachable means skip, or fail if `KAFKA_REQUIRED=true`. Wait with `KafkaConsumerClient.waitForMessages()` (it polls until a deadline). `utils/kafka/OrderEventProcessor.ts` is a stand-in consumer, because no real order service exists; to test a real service, swap in its handler.
- **Chaos:** the `chaos` project. Configured entirely by `CHAOS_*` env vars (documented in `utils/chaos/chaosConfig.ts`); it skips without them. It refuses protected namespaces and `*prod*` contexts. `ChaosClient` always passes `--context` and runs kubectl with an argument array (no shell). The spec runs in serial mode with no retries, and fixture teardown always removes experiments and waits for the pods to be ready again.
- **Isolation:** the chromium/firefox/webkit projects `testIgnore` both folders, so keep new Kafka/chaos tests inside them.

## Tagging

Tags go in `test.describe`/`test` titles (`@smoke`, `@sanity`, `@regression`, `@e2e`, `@negative`, `@edge`, `@ui`, `@search`, `@cart`, `@trackorder`, `@kafka`, `@producer`, `@consumer`, `@chaos`). The npm scripts select them with `--grep`, and a tag on a `describe` applies to all its tests.

## Known pitfalls

- **Case-sensitive file names:** CI runs on Linux, so import paths and `TestData/` paths must match file-name case exactly. A mismatch still works on Windows and hides the bug.
- **Browser download hangs:** on some Windows machines `npx playwright install` stalls at "extracting archive". Use `BROWSER_CHANNEL=msedge` with the chromium project instead.
- **Committed report folders:** `allure-report/` and `allure-results/` are committed and aren't in `.gitignore`. Every run adds new files to `allure-results/`, so don't commit those.
