import { OrderEvent, parseOrderEvent } from './orderEvent';
import { KafkaProducerClient } from './KafkaProducerClient';
import { ReceivedMessage } from './KafkaConsumerClient';

/**
 * Reference consumer logic for the orders topic. This repo has no real order service,
 * so this stands in for one; to test a real service, replace it with that service's handler.
 *
 * Behaviour the consumer tests check:
 *  - keeps a projection of the latest version of each order
 *  - idempotent: an eventId seen before is ignored (at-least-once delivery means duplicates happen)
 *  - an older version never overwrites a newer one (out-of-order delivery)
 *  - sends a "confirmation email" (recorded in emailsSent) exactly once per OrderPlaced
 *  - invalid messages go to a dead-letter topic with error headers instead of blocking the partition
 */
export class OrderEventProcessor {
    readonly orders = new Map<string, OrderEvent>();
    readonly emailsSent: string[] = [];
    private readonly seenEventIds = new Set<string>();

    constructor(private readonly dlqProducer: KafkaProducerClient, private readonly dlqTopic: string) {}

    async handle(message: ReceivedMessage): Promise<void> {
        let event: OrderEvent;
        try {
            event = parseOrderEvent(message.value);
        } catch (error) {
            await this.dlqProducer.sendRaw(this.dlqTopic, message.key, message.value, {
                'x-error': (error as Error).message,
                'x-original-topic': message.topic,
                'x-original-partition': String(message.partition),
                'x-original-offset': message.offset,
            });
            return;
        }

        if (this.seenEventIds.has(event.eventId)) return;
        this.seenEventIds.add(event.eventId);

        const current = this.orders.get(event.orderId);
        if (!current || event.version > current.version) {
            this.orders.set(event.orderId, event);
        }

        if (event.eventType === 'OrderPlaced') {
            this.emailsSent.push(event.orderId);
        }
    }

    /** Plain-object view of the end state, for comparing two processors. */
    snapshot() {
        return {
            orders: Object.fromEntries([...this.orders.entries()].sort(([a], [b]) => a.localeCompare(b))),
            emailsSent: [...this.emailsSent].sort(),
        };
    }
}
