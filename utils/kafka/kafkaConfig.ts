import { Kafka, KafkaConfig, logLevel, SASLOptions } from 'kafkajs';

/**
 * Settings for the Kafka suite, read from environment variables.
 *
 *   KAFKA_BROKERS          comma-separated broker list [localhost:9092]
 *   KAFKA_CLIENT_ID        client id shown in broker logs [playwright-kafka-tests]
 *   KAFKA_REQUIRED         "true" makes an unreachable broker fail the suite instead of skipping it
 *   KAFKA_SSL              "true" to connect over TLS
 *   KAFKA_SASL_MECHANISM   plain | scram-sha-256 | scram-sha-512 (optional)
 *   KAFKA_SASL_USERNAME / KAFKA_SASL_PASSWORD   credentials when a SASL mechanism is set
 *   KAFKA_MESSAGE_TIMEOUT_MS   how long tests wait for expected messages [20000]
 */
export interface KafkaTestConfig {
    brokers: string[];
    clientId: string;
    required: boolean;
    ssl: boolean;
    sasl?: SASLOptions;
    messageTimeoutMs: number;
}

export function loadKafkaConfig(): KafkaTestConfig {
    const mechanism = process.env.KAFKA_SASL_MECHANISM as 'plain' | 'scram-sha-256' | 'scram-sha-512' | undefined;
    if (mechanism && !['plain', 'scram-sha-256', 'scram-sha-512'].includes(mechanism)) {
        throw new Error(`Unsupported KAFKA_SASL_MECHANISM "${mechanism}"`);
    }

    return {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map(b => b.trim()).filter(Boolean),
        clientId: process.env.KAFKA_CLIENT_ID || 'playwright-kafka-tests',
        required: process.env.KAFKA_REQUIRED === 'true',
        ssl: process.env.KAFKA_SSL === 'true',
        sasl: mechanism
            ? { mechanism, username: process.env.KAFKA_SASL_USERNAME ?? '', password: process.env.KAFKA_SASL_PASSWORD ?? '' } as SASLOptions
            : undefined,
        messageTimeoutMs: Number(process.env.KAFKA_MESSAGE_TIMEOUT_MS) || 20_000,
    };
}

export function createKafka(config: KafkaTestConfig, overrides: Partial<KafkaConfig> = {}): Kafka {
    return new Kafka({
        clientId: config.clientId,
        brokers: config.brokers,
        ssl: config.ssl,
        sasl: config.sasl,
        logLevel: logLevel.ERROR,
        ...overrides,
    });
}

/** Returns null when the broker answers, or a human-readable reason when it doesn't. */
export async function checkBroker(config: KafkaTestConfig): Promise<string | null> {
    // Silent: the returned reason is the only output wanted when the broker is down.
    const admin = createKafka(config, { connectionTimeout: 3_000, retry: { retries: 1 }, logLevel: logLevel.NOTHING }).admin();
    try {
        await admin.connect();
        await admin.describeCluster();
        return null;
    } catch (error) {
        const reason = (error as Error).message.replace(/:\s*$/, '') || 'connection failed';
        return `Kafka broker not reachable at ${config.brokers.join(',')} (${reason}). ` +
            'Start a broker or set KAFKA_BROKERS.';
    } finally {
        await admin.disconnect().catch(() => undefined);
    }
}
