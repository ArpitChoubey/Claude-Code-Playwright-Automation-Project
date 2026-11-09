import { test } from '@fixtures';

test.describe('Cart Functionality @regression @cart', () => {

    test('Add product to cart @smoke', async ({ navigationModule, cartModule }) => {
        await test.step('Open home page', async () => {
            await navigationModule.openHome();
        });

        const title = await test.step('Open the first product', async () => {
            return cartModule.openFirstProductFromHome();
        });

        await test.step('Add it to the cart', async () => {
            await cartModule.addCurrentProductToCart();
        });

        await test.step('Cart page lists the product', async () => {
            await cartModule.openCart();
            await cartModule.verifyCartContains(title);
        });
    });

    test('New visitor sees an empty cart @sanity', async ({ navigationModule, cartModule }) => {
        await test.step('Open home page', async () => {
            await navigationModule.openHome();
        });

        await test.step('Open cart from the header', async () => {
            await cartModule.openCart();
        });

        await test.step('Cart is empty', async () => {
            await cartModule.verifyCartEmpty();
        });
    });
});
