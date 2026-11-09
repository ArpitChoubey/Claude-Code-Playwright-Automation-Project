import { test } from '@fixtures';
import { DataProvider } from '@utils/DataProvider';
import { RandomDataUtil } from '@utils/RandomDataGenerator';

// The tracking form is a 17TRACK widget. It validates empty input with a browser alert,
// but shows nothing on this page for a submitted number, so results can't be asserted here.
test.describe('Track Order Tests @regression @trackorder', () => {

    test.beforeEach(async ({ trackOrderModule }) => {
        await test.step('Open Track Order page', async () => {
            await trackOrderModule.open();
        });
    });

    test('Track order page shows the tracking form @smoke', async ({ trackOrderModule }) => {
        await test.step('Title, instructions, input and button are shown', async () => {
            await trackOrderModule.verifyPageContent();
            await trackOrderModule.verifyInstructionsShown();
        });
    });

    test('Track order accepts a tracking number', async ({ trackOrderModule }) => {
        const { validTrackingNumber } = DataProvider.getTrackOrderData();

        await test.step(`Submit "${validTrackingNumber}"`, async () => {
            await trackOrderModule.trackAndVerifyAccepted(validTrackingNumber);
        });
    });

    test('Track order accepts a random tracking number @negative', async ({ trackOrderModule }) => {
        const trackingNumber = RandomDataUtil.getInvalidTrackingNumber();

        await test.step(`Submit "${trackingNumber}"`, async () => {
            await trackOrderModule.trackAndVerifyAccepted(trackingNumber);
        });
    });

    test('Track order with empty input shows a validation alert @edge', async ({ trackOrderModule }) => {
        await test.step('Submit with no tracking number', async () => {
            await trackOrderModule.submitEmptyAndVerifyAlert('Enter the tracking number.');
        });
    });
});
