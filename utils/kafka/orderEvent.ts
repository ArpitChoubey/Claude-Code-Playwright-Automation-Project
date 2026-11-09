import { faker } from '@faker-js/faker';

export type OrderEventType = 'OrderPlaced' | 'OrderUpdated' | 'OrderCancelled';

/** The event published to the orders topic. `version` increases with every change to one order. */
export interface OrderEvent {
    eventId: string;
    eventType: OrderEventType;
    orderId: string;
    version: number;
    customerEmail: string;
    amount: number;
    occurredAt: string;
}

export function orderEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
    return {
        eventId: faker.string.uuid(),
        eventType: 'OrderPlaced',
        orderId: `order-${faker.string.alphanumeric(8).toLowerCase()}`,
        version: 1,
        customerEmail: faker.internet.email().toLowerCase(),
        amount: faker.number.float({ min: 5, max: 500, fractionDigits: 2 }),
        occurredAt: new Date().toISOString(),
        ...overrides,
    };
}

/** Parses and validates a message value. Throws with a reason for anything that isn't a valid OrderEvent. */
export function parseOrderEvent(value: string | null): OrderEvent {
    if (value === null) throw new Error('message has no value');

    let data: any;
    try {
        data = JSON.parse(value);
    } catch {
        throw new Error('value is not valid JSON');
    }

    const types: OrderEventType[] = ['OrderPlaced', 'OrderUpdated', 'OrderCancelled'];
    if (typeof data?.eventId !== 'string' || !data.eventId) throw new Error('eventId is missing');
    if (!types.includes(data.eventType)) throw new Error(`unknown eventType "${data.eventType}"`);
    if (typeof data.orderId !== 'string' || !data.orderId) throw new Error('orderId is missing');
    if (!Number.isInteger(data.version) || data.version < 1) throw new Error('version must be a positive integer');
    if (typeof data.amount !== 'number') throw new Error('amount must be a number');

    return data as OrderEvent;
}
