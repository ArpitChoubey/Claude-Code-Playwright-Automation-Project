import { Response } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
    title = () => this.page.getByRole('heading', { level: 1 });
    // The main product form comes first; "You may also like" cards can add more buttons further down.
    addToCartButton = () => this.page.getByRole('button', { name: 'Add to cart', exact: true }).first();
    cartNotification = () => this.page.locator('#cart-notification');

    async getTitle(): Promise<string> {
        return (await this.title().textContent())?.trim() ?? '';
    }

    /** Clicks Add to cart and resolves with the store's /cart/add response. */
    async clickAddToCart(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(r => r.url().includes('/cart/add') && r.request().method() === 'POST'),
            this.addToCartButton().click(),
        ]);
        return response;
    }
}
