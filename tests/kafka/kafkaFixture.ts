import { test as base } from '@playwright/test';
import { Admin, Kafka } from 'kafkajs';
import { checkBroker, createKafka, KafkaTestConfig, loadKafkaConfig } from '../../utils/kafka/kafkaConfig';
import { KafkaProducerClient } from '../../utils/kafka/KafkaProducerClient';
import { KafkaConsumerClient } from '../../utils/kafka/KafkaConsumerClient';

type KafkaFixtures = {
    kafkaConfig: KafkaTestConfig;
    kafka: Kafka;
    /** Creates a uniquely named topic for this test; deleted when the test ends. */
    createTopic: (partitions?: number) => Promise<string>;
    producer: KafkaProducerClient;
    /** Creates a consumer; a unique group id is generated unless one is given. Stopped when the test ends. */
    createConsumer: (groupId?: string) => KafkaConsumerClient;
};

// Checked once per worker, so an unreachable broker costs one connection timeout, not one per test.
let brokerProblem: Promise<string | null> | undefined;

const unique = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const test = base.extend<KafkaFixtures>({
    kafkaConfig: async ({}, use, testInfo) => {
        const config = loadKafkaConfig();
        const problem = await (brokerProblem ??= checkBroker(config));
        if (problem) {
            if (config.required) throw new Error(problem);
            testInfo.skip(true, problem);
        }
        await use(config);
    },

    kafka: async ({ kafkaConfig }, use) => {
        await use(createKafka(kafkaConfig));
    },

    createTopic: async ({ kafka }, use, testInfo) => {
        const admin: Admin = kafka.admin();
        await admin.connect();
        const created: string[] = [];
        const slug = testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-+$/, '');

        await use(async (partitions = 3) => {
            const topic = `pw-${slug}-${unique()}`;
            await admin.createTopics({ topics: [{ topic, numPartitions: partitions }], waitForLeaders: true });
            created.push(topic);
            return topic;
        });

        if (created.length > 0) await admin.deleteTopics({ topics: created }).catch(() => undefined);
        await admin.disconnect();
    },

    // Depends on createTopic so it is torn down before the topics are deleted.
    producer: async ({ kafka, createTopic: _ }, use) => {
        const producer = new KafkaProducerClient(kafka);
        await producer.connect();
        await use(producer);
        await producer.disconnect();
    },

    createConsumer: async ({ kafka, createTopic: _ }, use) => {
        const consumers: KafkaConsumerClient[] = [];
        await use((groupId = `pw-group-${unique()}`) => {
            const consumer = new KafkaConsumerClient(kafka, groupId);
            consumers.push(consumer);
            return consumer;
        });
        await Promise.all(consumers.map(c => c.stop().catch(() => undefined)));
    },
});

export { expect } from '@playwright/test';
