import { BasePage } from './BasePage';

export class HomePage extends BasePage {
    bannerText = () => this.page.getByText('Browse our latest products', { exact: true });
    // Dawn theme product cards. Collection cards ("Home", ...) use a different wrapper.
    productCards = () => this.page.locator('#MainContent .product-card-wrapper');
    productCardLink = (index: number) => this.productCards().nth(index).getByRole('link').first();

    async clickProduct(index: number): Promise<void> {
        await this.productCardLink(index).click();
    }

    async getProductCount(): Promise<number> {
        return this.productCards().count();
    }
}
