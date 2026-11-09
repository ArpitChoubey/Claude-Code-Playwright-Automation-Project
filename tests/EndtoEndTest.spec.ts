import { test } from '@fixtures';
import { RandomDataUtil } from '@utils/RandomDataGenerator';

test.describe('SparkleCart E2E Flow @smoke @e2e @regression', () => {

    test('Complete user journey: Search → Add to Cart → Validate Cart', async ({ navigationModule, searchModule, cartModule, productPage }) => {
        const product = RandomDataUtil.getRandomProduct();

        await test.step('Open home page', async () => {
            await navigationModule.openHome();
        });

        await test.step(`Search for "${product}"`, async () => {
            await searchModule.searchFor(product);
            await searchModule.verifyResultsShown(1);
        });

        const title = await test.step('Open the first result', async () => {
            await searchModule.openResult(0);
            return productPage.getTitle();
        });

        await test.step('Add the product to the cart', async () => {
            await cartModule.addCurrentProductToCart();
        });

        await test.step('Cart lists the product with a total', async () => {
            await cartModule.openCart();
            await cartModule.verifyCartContains(title);
        });
    });
});
