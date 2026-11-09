import { BasePage } from './BasePage';

export class CartPage extends BasePage {
    cartItems = () => this.page.locator('#main-cart-items .cart-item');
    itemNames = () => this.page.locator('#main-cart-items .cart-item__name');
    quantityInput = (index: number) => this.cartItems().nth(index).getByRole('spinbutton');
    removeButton = (index: number) => this.cartItems().nth(index).getByRole('button', { name: /^Remove/ });
    totalPrice = () => this.page.locator('.totals__total-value');
    emptyCartHeading = () => this.page.getByRole('heading', { name: 'Your cart is empty' });
    checkoutButton = () => this.page.getByRole('button', { name: 'Check out' });

    async getItemCount(): Promise<number> {
        return this.cartItems().count();
    }

    async getItemNames(): Promise<string[]> {
        return (await this.itemNames().allTextContents()).map(n => n.trim());
    }

    async setQuantity(index: number, quantity: number): Promise<void> {
        await this.quantityInput(index).fill(String(quantity));
        await this.quantityInput(index).press('Enter');
    }

    async removeItem(index: number): Promise<void> {
        await this.removeButton(index).click();
    }

    async clickCheckout(): Promise<void> {
        await this.checkoutButton().click();
    }
}
