import { test as base } from '@playwright/test';
import { CartPage, HomePage, ProductPage, SearchResultsPage, TrackOrderPage } from '@pages/index';
import { CartModule, NavigationModule, SearchModule, TrackOrderModule } from '@modules/index';

/** Layer 6: tests receive pages and modules from here and never construct them. */
type Fixtures = {
    homePage: HomePage;
    searchResultsPage: SearchResultsPage;
    productPage: ProductPage;
    cartPage: CartPage;
    trackOrderPage: TrackOrderPage;

    navigationModule: NavigationModule;
    searchModule: SearchModule;
    cartModule: CartModule;
    trackOrderModule: TrackOrderModule;
};

export const test = base.extend<Fixtures>({
    homePage: async ({ page }, use) => { await use(new HomePage(page)); },
    searchResultsPage: async ({ page }, use) => { await use(new SearchResultsPage(page)); },
    productPage: async ({ page }, use) => { await use(new ProductPage(page)); },
    cartPage: async ({ page }, use) => { await use(new CartPage(page)); },
    trackOrderPage: async ({ page }, use) => { await use(new TrackOrderPage(page)); },

    navigationModule: async ({ homePage }, use) => { await use(new NavigationModule(homePage)); },
    searchModule: async ({ homePage, searchResultsPage }, use) => { await use(new SearchModule(homePage, searchResultsPage)); },
    cartModule: async ({ homePage, productPage, cartPage }, use) => { await use(new CartModule(homePage, productPage, cartPage)); },
    trackOrderModule: async ({ trackOrderPage }, use) => { await use(new TrackOrderModule(trackOrderPage)); },
});

export { expect } from '@playwright/test';
