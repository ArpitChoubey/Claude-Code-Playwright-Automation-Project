import { test } from '@fixtures';
import { DataProvider } from '@utils/DataProvider';
import { RandomDataUtil } from '@utils/RandomDataGenerator';

test.describe('Search Functionality @regression @search', () => {

    test.beforeEach(async ({ navigationModule }) => {
        await test.step('Open home page', async () => {
            await navigationModule.openHome();
        });
    });

    test('Search with valid product @smoke', async ({ searchModule }) => {
        const { validSearch } = DataProvider.getSearchData();

        await test.step(`Search for "${validSearch}"`, async () => {
            await searchModule.searchFor(validSearch);
        });

        await test.step('Results are shown', async () => {
            await searchModule.verifyResultsShown(1);
        });
    });

    test('Search with invalid product @negative', async ({ searchModule }) => {
        const term = RandomDataUtil.getInvalidSearch();

        await test.step(`Search for nonsense term "${term}"`, async () => {
            await searchModule.searchFor(term);
        });

        await test.step('"No results" message is shown and no products are listed', async () => {
            await searchModule.verifyNoResults(term);
        });
    });
});
