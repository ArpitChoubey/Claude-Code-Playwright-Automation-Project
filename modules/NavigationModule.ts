import { expect } from '@playwright/test';
import { HomePage, NavLinkName } from '@pages/index';
import { Logger } from '@utils/Logger';
import { config } from '@config';

const NAV_TARGETS: Record<NavLinkName, string> = {
    'Home': config.paths.home,
    'Shop All': config.paths.shopAll,
    'FAQs': config.paths.faqs,
    'Track Order': config.paths.trackOrder,
    'Contact': config.paths.contact,
};

export class NavigationModule {
    private readonly logger = new Logger('NavigationModule');

    constructor(private readonly homePage: HomePage) {}

    async openHome(): Promise<void> {
        this.logger.info('Opening home page');
        await this.homePage.open(config.paths.home);
        await expect(this.homePage.bannerText()).toBeVisible();
    }

    /** Clicks a header link and checks it lands on that link's page. */
    async goTo(link: NavLinkName): Promise<void> {
        this.logger.info(`Navigating via header link "${link}"`);
        await this.homePage.clickNavLink(link);
        await this.homePage.waitForUrl(url => url.pathname === NAV_TARGETS[link]);
    }

    async goBack(): Promise<void> {
        await this.homePage.goBack();
    }

    async verifyBannerText(expected: string): Promise<void> {
        await expect(this.homePage.bannerText()).toHaveText(expected);
    }

    async verifyProductsListed(minimum = 1): Promise<number> {
        await expect(this.homePage.productCards().first()).toBeVisible();
        const count = await this.homePage.getProductCount();
        expect(count).toBeGreaterThanOrEqual(minimum);
        this.logger.info(`Home page lists ${count} products`);
        return count;
    }
}
