import { BasePage } from './BasePage';

export class SearchResultsPage extends BasePage {
    resultCards = () => this.page.locator('#MainContent .product-card-wrapper');
    resultLink = (index: number) => this.resultCards().nth(index).getByRole('link').first();
    noResultsMessage = () => this.page.getByText(/No results found for/);

    async getResultCount(): Promise<number> {
        return this.resultCards().count();
    }

    async clickResult(index: number): Promise<void> {
        await this.resultLink(index).click();
    }
}
