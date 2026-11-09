import { expect } from '@playwright/test';
import { HomePage, SearchResultsPage } from '@pages/index';
import { Logger } from '@utils/Logger';
import { config } from '@config';

export class SearchModule {
    private readonly logger = new Logger('SearchModule');

    constructor(private readonly homePage: HomePage, private readonly resultsPage: SearchResultsPage) {}

    /** Searches from the header search box, which sits behind the search icon. */
    async searchFor(term: string): Promise<void> {
        this.logger.info(`Searching for "${term}"`);
        await this.homePage.openSearch();
        await this.homePage.fillSearch(term);
        await this.homePage.submitSearch();
        await this.resultsPage.waitForUrl(url => url.pathname === config.paths.search && url.searchParams.get('q') === term);
    }

    async verifyResultsShown(minimum = 1): Promise<number> {
        await expect(this.resultsPage.resultCards().first()).toBeVisible();
        const count = await this.resultsPage.getResultCount();
        expect(count).toBeGreaterThanOrEqual(minimum);
        this.logger.info(`Search returned ${count} results`);
        return count;
    }

    async verifyNoResults(term: string): Promise<void> {
        await expect(this.resultsPage.noResultsMessage()).toContainText(term);
        await expect(this.resultsPage.resultCards()).toHaveCount(0);
    }

    async openResult(index = 0): Promise<void> {
        this.logger.info(`Opening search result #${index + 1}`);
        await this.resultsPage.clickResult(index);
        await this.resultsPage.waitForUrl(/\/products\//);
    }
}
