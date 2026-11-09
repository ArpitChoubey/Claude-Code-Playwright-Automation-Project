import { expect } from '@playwright/test';
import { TrackOrderPage } from '@pages/index';
import { Logger } from '@utils/Logger';
import { config } from '@config';

export class TrackOrderModule {
    private readonly logger = new Logger('TrackOrderModule');

    constructor(private readonly trackOrderPage: TrackOrderPage) {}

    async open(): Promise<void> {
        await this.trackOrderPage.open(config.paths.trackOrder);
        await this.verifyPageContent();
    }

    async verifyPageContent(): Promise<void> {
        await expect(this.trackOrderPage.pageTitle()).toBeVisible();
        await expect(this.trackOrderPage.trackingInput()).toBeVisible();
        await expect(this.trackOrderPage.trackButton()).toBeVisible();
    }

    async verifyInstructionsShown(): Promise<void> {
        await expect(this.trackOrderPage.instructions()).toBeVisible();
    }

    /** Submits a tracking number and checks the widget accepted it (no validation alert). */
    async trackAndVerifyAccepted(trackingNumber: string): Promise<void> {
        this.logger.info(`Tracking "${trackingNumber}"`);
        await this.trackOrderPage.enterTrackingNumber(trackingNumber);
        const alert = await this.trackOrderPage.clickTrackAndCaptureAlert();
        expect(alert, 'Widget rejected a non-empty tracking number').toBeNull();
        await expect(this.trackOrderPage.trackingInput()).toHaveValue(trackingNumber);
    }

    /** Submits with an empty field and checks the widget's validation alert. */
    async submitEmptyAndVerifyAlert(expectedMessage: string): Promise<void> {
        await this.trackOrderPage.enterTrackingNumber('');
        const alert = await this.trackOrderPage.clickTrackAndCaptureAlert();
        expect(alert).toBe(expectedMessage);
    }
}
