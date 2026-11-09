# Playwright TypeScript E-Commerce Automation Framework

<p align="center">
<img src="https://img.shields.io/badge/Playwright-45ba63?style=for-the-badge&logo=playwright&logoColor=white"/>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white"/>
<img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white"/>
<img src="https://img.shields.io/badge/Allure-Reporting-orange?style=for-the-badge"/>
<img src="https://img.shields.io/badge/GitHub-Actions-black?style=for-the-badge&logo=githubactions"/>
</p>

A layered Playwright + TypeScript test framework with three suites:

| Suite | What it tests | Needs |
|-------|---------------|-------|
| **Browser UI** (`tests/*.spec.ts`) | The live [Sparkle Cart](https://sparklecartonline.com/) store: home page, navigation, search, cart, checkout path, order tracking | Internet access |
| **Kafka** (`tests/kafka/`) | Event producer and consumer behaviour: partitioning, ordering, idempotency, dead-letter routing, offset commits, replay | A Kafka broker |
| **Resilience / chaos** (`tests/resilience/`) | Whether a storefront running on Kubernetes stays usable while pods are killed, the network is slowed or the app is taken down | A Kubernetes cluster with Chaos Mesh |

The Kafka and chaos suites **skip themselves** when their infrastructure isn't configured, so `npm test` works on any machine.

---

## Contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Running tests](#running-tests)
- [Browser UI suite](#browser-ui-suite)
- [Kafka suite](#kafka-suite)
- [Resilience (chaos) suite](#resilience-chaos-suite)
- [Configuration reference](#configuration-reference)
- [Reports](#reports)
- [Continuous integration](#continuous-integration)
- [Writing a new UI test](#writing-a-new-ui-test)
- [Troubleshooting](#troubleshooting)
- [Author](#author)

---

## Quick start

Requirements: **Node.js 18+** (LTS recommended) and Git.

```bash
git clone https://github.com/ArpitChoubey/Playwright-typescript-ecommerce-automation-framework.git
cd Playwright-typescript-ecommerce-automation-framework

npm ci                       # install exact dependency versions from package-lock.json
npx playwright install       # download Chromium, Firefox and WebKit

npx playwright test --project=chromium   # run the browser UI tests in Chromium
```

If the browser download hangs, use a browser you already have instead (see [Troubleshooting](#troubleshooting)):

```bash
BROWSER_CHANNEL=msedge npx playwright test --project=chromium
```

---

## Project structure

```
├── config/
│   └── index.ts                 # Base URL (BASE_URL) and site paths
├── pages/                       # Page objects: locators + single UI actions
│   ├── BasePage.ts              # Shared header: nav links, search, cart
│   ├── HomePage.ts
│   ├── SearchResultsPage.ts
│   ├── ProductPage.ts
│   ├── CartPage.ts
│   ├── TrackOrderPage.ts
│   └── index.ts                 # Barrel export
├── modules/                     # Business steps + assertions
│   ├── NavigationModule.ts
│   ├── SearchModule.ts
│   ├── CartModule.ts
│   ├── TrackOrderModule.ts
│   └── index.ts
├── fixtures/
│   └── index.ts                 # Injects pages and modules into tests
├── tests/
│   ├── homepageTest.spec.ts     # Browser UI specs
│   ├── search.spec.ts
│   ├── cart.spec.ts
│   ├── EndtoEndTest.spec.ts
│   ├── TrackOrderTest.spec.ts
│   ├── kafka/                   # Kafka producer/consumer specs + fixture
│   └── resilience/              # Chaos specs, fixture and availability probe
├── utils/
│   ├── Logger.ts                # Levelled, timestamped logging
│   ├── DataProvider.ts          # Reads TestData JSON/CSV
│   ├── RandomDataGenerator.ts   # Faker-based random data
│   ├── kafka/                   # Kafka config, producer, consumer, event model, reference consumer
│   └── chaos/                   # Chaos config, kubectl client, Chaos Mesh experiments
├── TestData/                    # JSON test data
├── .github/workflows/playwright.yml
├── playwright.config.ts
├── tsconfig.json                # Strict TS + path aliases
└── package.json
```

---

## Architecture

The browser UI suite follows a layered design where each layer only talks to the one below it:

```
Test spec  →  Fixture  →  Module  →  Page  →  Browser
```

| Layer | Responsibility | Rules |
|-------|----------------|-------|
| **Config** (`config/`) | Site URL and paths | The URL comes from `BASE_URL`; `playwright.config.ts` sets `baseURL` from it, so code uses relative paths |
| **Pages** (`pages/`) | Locators and single UI actions (`click`, `fill`) | Locators are arrow functions; no assertions, no branching |
| **Modules** (`modules/`) | Business steps (`searchFor`, `addCurrentProductToCart`) and their assertions (`verifyCartContains`) | Only use page methods and locators, never `page.locator()`; log with `Logger` |
| **Fixtures** (`fixtures/`) | Create pages and modules for each test | Tests never write `new SomePage(page)` |
| **Specs** (`tests/`) | Describe the scenario | Every action is wrapped in `test.step()`; each test sets up its own state |

**Path aliases** (from `tsconfig.json`) keep imports short:

```ts
import { test } from '@fixtures';
import { HomePage } from '@pages/index';
import { Logger } from '@utils/Logger';
import { config } from '@config';
```

**Locator strategy:** user-facing locators first (`getByRole`, `getByLabel`, `getByText`), CSS only when the site gives nothing better, with a comment explaining why.

**No fixed waits:** tests wait for real events instead. For example, adding to cart waits for the store's `POST /cart/add` response and the header cart count, not a 2-second sleep.

---

## Running tests

| Command | What it runs |
|---------|--------------|
| `npm test` | Everything: UI tests on Chromium, Firefox and WebKit, plus Kafka and chaos (which skip without infrastructure) |
| `npx playwright test --project=chromium` | UI tests on Chromium only |
| `npx playwright test tests/search.spec.ts` | One file |
| `npx playwright test -g "Search with valid product"` | One test, by title |
| `npm run test:smoke` | Tests tagged `@smoke` |
| `npm run test:sanity` | Tests tagged `@sanity` |
| `npm run test:regression` | Tests tagged `@regression` |
| `npm run test:e2e` | Tests tagged `@e2e` |
| `npm run test:kafka` | Kafka suite |
| `npm run test:chaos` | Chaos suite (one worker) |
| `npm run test:headed` | All tests with a visible browser |
| `npm run test:debug` | All tests in the Playwright Inspector |
| `npx playwright test --ui` | Playwright UI mode |
| `npm run typecheck` | Strict TypeScript check of the whole project |

> Playwright transpiles TypeScript without checking types, so run `npm run typecheck` before committing.

### Tags

Tags are written in test and `describe` titles. A tag on a `describe` applies to every test inside it.

| Tag | Meaning |
|-----|---------|
| `@smoke` | Fast, critical checks |
| `@sanity` | Basic health checks |
| `@regression` | Full regression set |
| `@e2e` | Full user journey |
| `@negative`, `@edge` | Invalid input and edge cases |
| `@ui`, `@search`, `@cart`, `@trackorder` | Browser UI feature areas |
| `@kafka`, `@producer`, `@consumer` | Kafka suite |
| `@chaos` | Resilience suite |

---

## Browser UI suite

Runs against the live store at `https://sparklecartonline.com` (a Shopify store using the Dawn theme). Set `BASE_URL` to point it at a staging copy.

| Spec | Tests |
|------|-------|
| `homepageTest.spec.ts` | Home page loads with banner and products; header links (Shop All, FAQs, Contact) open the right pages; banner text; product count |
| `search.spec.ts` | A known product returns results; a random nonsense term shows "No results found" and no products |
| `cart.spec.ts` | The first home-page product can be added and appears in the cart; a new visitor's cart is empty |
| `EndtoEndTest.spec.ts` | Search for a random product → open the first result → add to cart → the cart lists it with a total |
| `TrackOrderTest.spec.ts` | The tracking form is shown; non-empty tracking numbers are accepted; an empty submit shows the "Enter the tracking number." alert |

**About order tracking:** the form is a third-party 17TRACK widget. It shows nothing on this page after a number is submitted, so the tests can check validation and that a number is accepted, but not tracking results.

Test data lives in `TestData/*.json` and is read with `DataProvider`. Random values come from `RandomDataUtil` (Faker).

---

## Kafka suite

Producer and consumer tests that use the [KafkaJS](https://kafka.js.org/) client through Playwright's test runner. No browser is launched.

**Producer tests** (`tests/kafka/producer.spec.ts`)
- An event is read back with key, value and headers unchanged
- Every event for one order lands on the same partition
- Different orders are spread across partitions
- Events for one order are consumed in the order they were sent

**Consumer tests** (`tests/kafka/consumer.spec.ts`)
- Happy path: an `OrderPlaced` event creates the order and sends one email
- Duplicate delivery: the same event twice is applied once and emails once
- Out of order: an older version never overwrites a newer one
- Poison message: a malformed message goes to a dead-letter topic with error headers, and processing continues
- Restart: a consumer in the same group resumes from its committed offset
- Replay: reprocessing the whole topic gives the same end state

The consumer tests run against `utils/kafka/OrderEventProcessor.ts`, a **reference consumer** that stands in for a real order service. To test your own service, replace it with that service's message handler.

Each test creates its own uniquely named topics and consumer groups and deletes them afterwards. Tests wait by polling until a deadline, never by sleeping.

### Running it

Start a broker. With Docker:

```bash
docker run -d --name kafka -p 9092:9092 apache/kafka:3.9.0
npm run test:kafka
```

Or point at an existing cluster:

```bash
KAFKA_BROKERS=broker1:9092,broker2:9092 npm run test:kafka

# with TLS + SASL (e.g. a managed cloud cluster)
KAFKA_BROKERS=host:9092 KAFKA_SSL=true KAFKA_SASL_MECHANISM=plain \
KAFKA_SASL_USERNAME=key KAFKA_SASL_PASSWORD=secret npm run test:kafka
```

Without a reachable broker, the tests are **skipped**. Set `KAFKA_REQUIRED=true` (for example in CI) to make them **fail** instead.

---

## Resilience (chaos) suite

Uses [Chaos Mesh](https://chaos-mesh.org/) to inject faults into a storefront running on Kubernetes, and checks the storefront through the browser while each fault is active:

| Test | Fault | Passes when |
|------|-------|-------------|
| Steady state | none | The page loads within `CHAOS_LOAD_BUDGET_MS`. If this fails, the remaining tests are skipped, so faults are never injected into an app that's already broken |
| Pod kill | One app pod killed | At least `CHAOS_MIN_SUCCESS_RATE` of page loads succeed over `CHAOS_SAMPLE_WINDOW_MS` |
| Network latency | `CHAOS_LATENCY` added to app traffic | The page still renders within `CHAOS_DEGRADED_BUDGET_MS` |
| Full outage | Every app pod failed | The storefront actually goes down, then recovers within `CHAOS_RECOVERY_TIMEOUT_MS` once the fault is removed |

Raw availability samples and recovery time are attached to the HTML and Allure reports.

### Prerequisites

1. A Kubernetes cluster that **you are allowed to disrupt** (never production), with `kubectl` access
2. Chaos Mesh installed ([Helm install guide](https://chaos-mesh.org/docs/production-installation-using-helm/))
3. The storefront deployed in its own namespace (default `chaos-demo`) and reachable from your machine

### Running it

```bash
CHAOS_BASE_URL=http://storefront.local \
CHAOS_KUBE_CONTEXT=my-dev-cluster \
CHAOS_APP_SELECTOR=app=storefront \
npm run test:chaos
```

**Safety measures:**
- Every `kubectl` call passes the given context explicitly, so the suite never acts on whatever context happens to be current.
- It refuses the `kube-system`, `kube-public`, `kube-node-lease` and `chaos-mesh` namespaces.
- It refuses contexts whose name contains "prod" unless `CHAOS_ALLOW_PROD_CONTEXT=true`.
- Experiments are always removed when a test ends, even if it fails. Leftovers from a crashed run are cleaned up at the next start.
- Tests run one at a time with no retries.

---

## Configuration reference

All configuration is through environment variables.

### General

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `https://sparklecartonline.com` | Store the UI tests run against |
| `BROWSER_CHANNEL` | *(Playwright's Chromium)* | `msedge` or `chrome` runs the `chromium` project on an installed browser |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARN` or `ERROR` |
| `CI` | *(unset)* | When set: 2 retries, 1 worker, `test.only` fails the run |

### Kafka

| Variable | Default | Purpose |
|----------|---------|---------|
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated broker list |
| `KAFKA_CLIENT_ID` | `playwright-kafka-tests` | Client id shown in broker logs |
| `KAFKA_REQUIRED` | `false` | `true` = fail instead of skip when no broker answers |
| `KAFKA_SSL` | `false` | Connect over TLS |
| `KAFKA_SASL_MECHANISM` | *(none)* | `plain`, `scram-sha-256` or `scram-sha-512` |
| `KAFKA_SASL_USERNAME` / `KAFKA_SASL_PASSWORD` | *(none)* | SASL credentials |
| `KAFKA_MESSAGE_TIMEOUT_MS` | `20000` | How long tests wait for expected messages |

### Chaos

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHAOS_BASE_URL` | **required** | Storefront URL in the cluster |
| `CHAOS_KUBE_CONTEXT` | **required** | kubectl context to use |
| `CHAOS_APP_SELECTOR` | **required** | Label selector for the app pods, e.g. `app=storefront` |
| `CHAOS_NAMESPACE` | `chaos-demo` | Namespace of the app and experiments |
| `CHAOS_READY_SELECTOR` | `body` | CSS selector that proves the page rendered |
| `CHAOS_MIN_REPLICAS` | `1` | Ready pods required for steady state |
| `CHAOS_LOAD_BUDGET_MS` | `5000` | Max load time with no faults |
| `CHAOS_DEGRADED_BUDGET_MS` | `15000` | Max load time under network latency |
| `CHAOS_RECOVERY_TIMEOUT_MS` | `120000` | Max time to recover after a fault is removed |
| `CHAOS_SAMPLE_WINDOW_MS` | `30000` | How long to sample availability during pod kill |
| `CHAOS_SAMPLE_INTERVAL_MS` | `2000` | Gap between samples |
| `CHAOS_MIN_SUCCESS_RATE` | `0.9` | Share of samples that must succeed during pod kill |
| `CHAOS_LATENCY` | `500ms` | Latency injected by the network test |
| `CHAOS_ALLOW_PROD_CONTEXT` | `false` | Allow a context whose name contains "prod" |

---

## Reports

Every run writes three reports:

| Report | Location | Open with |
|--------|----------|-----------|
| Console | terminal | `list` reporter output |
| Playwright HTML | `playwright-report/` | `npx playwright show-report` |
| Allure | `allure-results/` | `npm run allure:serve`, or `npm run allure:generate && npm run allure:open` |

Screenshots are captured on failure, and traces on the first retry. Open a trace with `npx playwright show-trace <trace.zip>`.

---

## Continuous integration

`.github/workflows/playwright.yml` runs on pushes and pull requests to `main`/`master`:

1. `npm ci`
2. `npx playwright install --with-deps`
3. `npx playwright test`: the UI tests run on all three browsers; the Kafka and chaos suites skip because CI has no broker or cluster
4. Uploads `playwright-report/` as an artifact (kept 30 days)

To run the Kafka suite in CI, add a Kafka service container to the job and set `KAFKA_BROKERS` and `KAFKA_REQUIRED=true`.

---

## Writing a new UI test

1. **Locators** go in the page class, as arrow functions:

   ```ts
   // pages/ProductPage.ts
   quantityInput = () => this.page.getByRole('spinbutton', { name: 'Quantity' });

   async setQuantity(qty: number): Promise<void> {
       await this.quantityInput().fill(String(qty));
   }
   ```

2. **Business steps and checks** go in a module:

   ```ts
   // modules/CartModule.ts
   async addProductWithQuantity(qty: number): Promise<void> {
       this.logger.info(`Adding ${qty} items`);
       await this.productPage.setQuantity(qty);
       await this.addCurrentProductToCart();
   }
   ```

3. **New pages or modules** must be registered in `fixtures/index.ts` and the barrel `index.ts` files.

4. **The test** uses fixtures and `test.step()`, and is tagged:

   ```ts
   import { test } from '@fixtures';

   test('Add two of a product @cart @regression', async ({ navigationModule, cartModule }) => {
       await test.step('Open the first product', async () => {
           await navigationModule.openHome();
           await cartModule.openFirstProductFromHome();
       });
       await test.step('Add two to the cart', async () => {
           await cartModule.addProductWithQuantity(2);
       });
   });
   ```

5. **Check** with `npm run typecheck` and `npx playwright test -g "Add two"`.

**Avoid:**
- `page.waitForTimeout()`
- `console.log`
- assertions inside page classes
- creating pages inside tests
- sharing a `page` between tests
- hardcoding the site URL

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npx playwright install` hangs at "extracting archive" (seen on Windows) | Stop it, delete `%LOCALAPPDATA%\ms-playwright\__dirlock` and the half-written `chromium-*` folder, then either retry or run with `BROWSER_CHANNEL=msedge` (Edge ships with Windows) |
| `Executable doesn't exist at ...ms-playwright...` | Browsers aren't installed: run `npx playwright install`, or use `BROWSER_CHANNEL` |
| `npm ci` says the lock file is out of sync | Run `npm install` and commit the updated `package-lock.json` |
| All Kafka tests are skipped | No broker answered at `KAFKA_BROKERS`; the skip reason in the report says why |
| All chaos tests are skipped | `CHAOS_BASE_URL`, `CHAOS_KUBE_CONTEXT` or `CHAOS_APP_SELECTOR` isn't set |
| A test passes on Windows but fails in CI with "Cannot find module" or "ENOENT" | File name case: Linux is case-sensitive, so imports and `TestData/` paths must match exactly |
| UI tests fail after the store changes | The tests run against a live site; update the locators in `pages/` |

---

## Author

**Arpit Choubey**: SDET | QA Automation Engineer | Playwright | Selenium | API Testing | CI/CD

- GitHub: https://github.com/ArpitChoubey
- LinkedIn: https://www.linkedin.com/in/arpitchoubey/
- Medium: https://medium.com/@ArpitChoubey9

If you find this project useful, consider giving it a ⭐.
