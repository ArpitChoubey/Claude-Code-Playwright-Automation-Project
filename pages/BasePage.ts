import { Page, Response } from '@playwright/test';

export type NavLinkName = 'Home' | 'Shop All' | 'FAQs' | 'Track Order' | 'Contact';

/**
 * Layer 2 base: the site header appears on every page, so its locators live here.
 * Pages hold locators (as arrow functions, re-evaluated on every call) and simple
 * UI actions only: no assertions, no conditionals. Business flows live in modules/.
 */
export abstract class BasePage {
    constructor(protected readonly page: Page) {}

    // Header
    header = () => this.page.getByRole('banner');
    navLink = (name: NavLinkName) => this.header().getByRole('navigation').getByRole('link', { name, exact: true });
    // The search toggle is a <summary> with aria-label="Search"; summary has no reliable ARIA role.
    searchToggle = () => this.header().locator('summary[aria-label="Search"]');
    searchInput = () => this.page.getByRole('combobox', { name: 'Search' });
    cartLink = () => this.header().getByRole('link', { name: /^Cart/ });
    cartCount = () => this.header().locator('.cart-count-bubble');

    async open(path: string): Promise<Response | null> {
        return this.page.goto(path);
    }

    async waitForUrl(url: string | RegExp | ((url: URL) => boolean)): Promise<void> {
        await this.page.waitForURL(url);
    }

    url(): string {
        return this.page.url();
    }

    async clickNavLink(name: NavLinkName): Promise<void> {
        await this.navLink(name).click();
    }

    async openSearch(): Promise<void> {
        await this.searchToggle().click();
    }

    async fillSearch(term: string): Promise<void> {
        await this.searchInput().fill(term);
    }

    async submitSearch(): Promise<void> {
        await this.searchInput().press('Enter');
    }

    async clickCart(): Promise<void> {
        await this.cartLink().click();
    }

    async goBack(): Promise<void> {
        await this.page.goBack();
    }
}
