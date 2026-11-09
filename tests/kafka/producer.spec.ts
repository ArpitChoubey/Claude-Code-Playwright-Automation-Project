import { test, expect } from './kafkaFixture';
import { orderEvent } from '../../utils/kafka/orderEvent';

test.describe('Kafka producer @kafka @producer', () => {
    test.describe.configure({ timeout: 60_000 });

    test('publishes an order event that is read back with key, value and headers intact', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const event = orderEvent();

        const sent = await producer.sendEvent(topic, event, { 'trace-id': 'trace-123' });

        const consumer = createConsumer();
        await consumer.start(topic);
        const [message] = await consumer.waitForMessages(1, kafkaConfig.messageTimeoutMs);

        expect(message.key).toBe(event.orderId);
        expect(JSON.parse(message.value!)).toEqual(event);
        expect(message.headers).toMatchObject({ 'event-type': 'OrderPlaced', 'trace-id': 'trace-123' });
        expect(message.partition).toBe(sent.partition);
        expect(message.offset).toBe(sent.offset);
    });

    test('every event for one order goes to the same partition', async ({ createTopic, producer }) => {
        const topic = await createTopic(3);
        const first = orderEvent();
        const sameOrder = [1, 2, 3, 4, 5].map(version => orderEvent({ orderId: first.orderId, version }));

        const records = await producer.sendEvents(topic, sameOrder);

        expect(new Set(records.map(r => r.partition)).size).toBe(1);
    });

    test('different orders are spread across partitions', async ({ createTopic, producer }) => {
        const topic = await createTopic(3);

        // 20 random keys on 3 partitions: all landing on one partition has ~1e-9 probability.
        const records = await producer.sendEvents(topic, Array.from({ length: 20 }, () => orderEvent()));

        expect(new Set(records.map(r => r.partition)).size).toBeGreaterThan(1);
    });

    test('events for one order are consumed in the order they were produced', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic(3);
        const orderId = orderEvent().orderId;
        const events = [1, 2, 3, 4, 5].map(version =>
            orderEvent({ orderId, version, eventType: version === 1 ? 'OrderPlaced' : 'OrderUpdated' }));

        await producer.sendEvents(topic, events);

        const consumer = createConsumer();
        await consumer.start(topic);
        const messages = await consumer.waitForMessages(5, kafkaConfig.messageTimeoutMs);

        expect(messages.map(m => JSON.parse(m.value!).version)).toEqual([1, 2, 3, 4, 5]);
    });
});
