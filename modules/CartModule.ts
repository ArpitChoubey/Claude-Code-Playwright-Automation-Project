import { expect } from '@playwright/test';
import { CartPage, HomePage, ProductPage } from '@pages/index';
import { Logger } from '@utils/Logger';
import { config } from '@config';

export class CartModule {
    private readonly logger = new Logger('CartModule');

    constructor(
        private readonly homePage: HomePage,
        private readonly productPage: ProductPage,
        private readonly cartPage: CartPage,
    ) {}

    async openFirstProductFromHome(): Promise<string> {
        await this.homePage.clickProduct(0);
        await this.productPage.waitForUrl(/\/products\//);
        const title = await this.productPage.getTitle();
        this.logger.info(`Opened product "${title}"`);
        return title;
    }

    /**
     * Adds the open product to the cart. Waits for the store's /cart/add response and the
     * header cart count instead of a fixed timeout.
     */
    async addCurrentProductToCart(): Promise<void> {
        this.logger.info('Adding product to cart');
        const response = await this.productPage.clickAddToCart();
        expect(response.ok(), `POST /cart/add returned ${response.status()}`).toBe(true);
        await expect(this.productPage.cartCount()).toBeVisible();
    }

    async openCart(): Promise<void> {
        await this.homePage.clickCart();
        await this.cartPage.waitForUrl(url => url.pathname === config.paths.cart);
    }

    async openCartDirectly(): Promise<void> {
        await this.cartPage.open(config.paths.cart);
    }

    async verifyCartContains(productTitle: string): Promise<void> {
        await expect(this.cartPage.cartItems().first()).toBeVisible();
        expect(await this.cartPage.getItemNames()).toContain(productTitle);
        await expect(this.cartPage.totalPrice()).toBeVisible();
        this.logger.info(`Cart contains "${productTitle}"`);
    }

    async verifyCartEmpty(): Promise<void> {
        await expect(this.cartPage.emptyCartHeading()).toBeVisible();
        await expect(this.cartPage.cartItems()).toHaveCount(0);
    }
}
