import { test } from '@fixtures';

test.describe('Home Page Tests @smoke @ui @regression', () => {

    test.beforeEach(async ({ navigationModule }) => {
        await test.step('Open home page', async () => {
            await navigationModule.openHome();
        });
    });

    test('Verify homepage loads successfully @smoke', async ({ navigationModule }) => {
        await test.step('Banner and product listing are shown', async () => {
            await navigationModule.verifyBannerText('Browse our latest products');
            await navigationModule.verifyProductsListed();
        });
    });

    test('Verify navigation menu links @regression', async ({ navigationModule }) => {
        for (const link of ['Shop All', 'FAQs', 'Contact'] as const) {
            await test.step(`Header link "${link}" opens its page`, async () => {
                await navigationModule.goTo(link);
                await navigationModule.goBack();
            });
        }
    });

    test('Verify banner text @ui', async ({ navigationModule }) => {
        await test.step('Banner text matches', async () => {
            await navigationModule.verifyBannerText('Browse our latest products');
        });
    });

    test('Verify product listing count @sanity', async ({ navigationModule }) => {
        await test.step('At least one product is listed', async () => {
            await navigationModule.verifyProductsListed(1);
        });
    });
});
