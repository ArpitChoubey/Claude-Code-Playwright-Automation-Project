import { Dialog } from '@playwright/test';
import { BasePage } from './BasePage';

/** The tracking form is a 17TRACK widget embedded in the page. */
export class TrackOrderPage extends BasePage {
    pageTitle = () => this.page.getByRole('heading', { name: 'Track Order', level: 1 });
    instructions = () => this.page.getByText('Enter your tracking number', { exact: false }).first();
    // The widget's input has no label, so an id is the only stable hook.
    trackingInput = () => this.page.locator('#YQNum');
    // <input type="button" value="TRACK ORDER">: its value is its accessible name.
    trackButton = () => this.page.getByRole('button', { name: 'TRACK ORDER', exact: true });

    async enterTrackingNumber(trackingNumber: string): Promise<void> {
        await this.trackingInput().fill(trackingNumber);
    }

    async clickTrack(): Promise<void> {
        await this.trackButton().click();
    }

    /**
     * Clicks Track and returns the text of the browser alert the widget raises, or null if none.
     * The alert blocks the page until handled, so a handler dismisses it the moment it opens;
     * the widget raises it synchronously inside the click, so it has fired once click() returns.
     */
    async clickTrackAndCaptureAlert(): Promise<string | null> {
        let message: string | null = null;
        const onDialog = async (dialog: Dialog) => {
            message = dialog.message();
            await dialog.dismiss();
        };
        this.page.once('dialog', onDialog);
        try {
            await this.trackButton().click();
        } finally {
            this.page.off('dialog', onDialog);
        }
        return message;
    }
}
