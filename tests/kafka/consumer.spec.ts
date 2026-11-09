import { test, expect } from './kafkaFixture';
import { orderEvent } from '../../utils/kafka/orderEvent';
import { OrderEventProcessor } from '../../utils/kafka/OrderEventProcessor';

// The consumer tests from the kafka-event-driven-testing checklist: happy path, duplicate,
// out-of-order, poison message to DLQ, and replay, plus resuming from committed offsets.
// OrderEventProcessor is the consumer logic under test.
test.describe('Kafka consumer @kafka @consumer', () => {
    test.describe.configure({ timeout: 60_000 });

    test('happy path: OrderPlaced creates the order and sends one email', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const dlq = await createTopic(1);
        const processor = new OrderEventProcessor(producer, dlq);
        const consumer = createConsumer();
        await consumer.start(topic, { handler: m => processor.handle(m) });

        const placed = orderEvent();
        await producer.sendEvent(topic, placed);
        await consumer.waitForMessages(1, kafkaConfig.messageTimeoutMs);

        expect(processor.orders.get(placed.orderId)).toEqual(placed);
        expect(processor.emailsSent).toEqual([placed.orderId]);
    });

    test('duplicate delivery: the same event twice is applied once and emails once', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const dlq = await createTopic(1);
        const processor = new OrderEventProcessor(producer, dlq);
        const consumer = createConsumer();
        await consumer.start(topic, { handler: m => processor.handle(m) });

        const placed = orderEvent();
        await producer.sendEvent(topic, placed);
        await producer.sendEvent(topic, placed); // same eventId, as a broker redelivery would be
        await consumer.waitForMessages(2, kafkaConfig.messageTimeoutMs);

        expect(processor.orders.size).toBe(1);
        expect(processor.emailsSent.filter(id => id === placed.orderId)).toHaveLength(1);
    });

    test('out of order: an older version does not overwrite a newer one', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const dlq = await createTopic(1);
        const processor = new OrderEventProcessor(producer, dlq);
        const consumer = createConsumer();
        await consumer.start(topic, { handler: m => processor.handle(m) });

        const placed = orderEvent({ version: 1 });
        const updated = orderEvent({ orderId: placed.orderId, version: 2, eventType: 'OrderUpdated', amount: placed.amount + 10 });
        await producer.sendEvent(topic, updated);
        await producer.sendEvent(topic, placed);
        await consumer.waitForMessages(2, kafkaConfig.messageTimeoutMs);

        expect(processor.orders.get(placed.orderId)).toEqual(updated);
    });

    test('poison message goes to the DLQ with error headers and consumption continues', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic(1); // one partition: a blocking poison message would stall the next event
        const dlq = await createTopic(1);
        const processor = new OrderEventProcessor(producer, dlq);
        const consumer = createConsumer();
        await consumer.start(topic, { handler: m => processor.handle(m) });

        const poison = await producer.sendRaw(topic, 'order-broken', '{not valid json');
        const good = orderEvent();
        await producer.sendEvent(topic, good);
        await consumer.waitForMessages(2, kafkaConfig.messageTimeoutMs);

        // Consumption continued past the bad message.
        expect(processor.orders.get(good.orderId)).toEqual(good);

        const dlqConsumer = createConsumer();
        await dlqConsumer.start(dlq);
        const [deadLetter] = await dlqConsumer.waitForMessages(1, kafkaConfig.messageTimeoutMs);

        expect(deadLetter.value).toBe('{not valid json');
        expect(deadLetter.key).toBe('order-broken');
        expect(deadLetter.headers).toMatchObject({
            'x-error': 'value is not valid JSON',
            'x-original-topic': topic,
            'x-original-partition': String(poison.partition),
            'x-original-offset': poison.offset,
        });
    });

    test('a restarted consumer in the same group resumes from its committed offset', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const groupId = `pw-group-resume-${Date.now().toString(36)}`;
        const firstBatch = [orderEvent(), orderEvent(), orderEvent()];
        const secondBatch = [orderEvent(), orderEvent()];

        const first = createConsumer(groupId);
        await first.start(topic);
        await producer.sendEvents(topic, firstBatch);
        await first.waitForMessages(3, kafkaConfig.messageTimeoutMs);
        await first.stop(); // commits offsets for the group

        await producer.sendEvents(topic, secondBatch);

        const restarted = createConsumer(groupId);
        await restarted.start(topic, { fromBeginning: true }); // ignored: the group has committed offsets
        const messages = await restarted.waitForMessages(2, kafkaConfig.messageTimeoutMs);

        expect(messages.map(m => JSON.parse(m.value!).eventId).sort())
            .toEqual(secondBatch.map(e => e.eventId).sort());
        expect(await restarted.countAfterQuietPeriod(2_000)).toBe(2);
    });

    test('replay: reprocessing the whole topic gives the same end state', async ({ createTopic, producer, createConsumer, kafkaConfig }) => {
        const topic = await createTopic();
        const dlq = await createTopic(1);

        const a = orderEvent();
        const b = orderEvent();
        const history = [
            a,
            b,
            orderEvent({ orderId: a.orderId, version: 2, eventType: 'OrderUpdated' }),
            a, // duplicate
            orderEvent({ orderId: b.orderId, version: 2, eventType: 'OrderCancelled' }),
        ];
        await producer.sendEvents(topic, history);

        const original = new OrderEventProcessor(producer, dlq);
        const live = createConsumer();
        await live.start(topic, { handler: m => original.handle(m) });
        await live.waitForMessages(history.length, kafkaConfig.messageTimeoutMs);

        // A new consumer group starts from the earliest offset: a full replay.
        const replayed = new OrderEventProcessor(producer, dlq);
        const replay = createConsumer();
        await replay.start(topic, { fromBeginning: true, handler: m => replayed.handle(m) });
        await replay.waitForMessages(history.length, kafkaConfig.messageTimeoutMs);

        expect(replayed.snapshot()).toEqual(original.snapshot());
        expect(original.snapshot().emailsSent).toEqual([a.orderId, b.orderId].sort());
    });
});
