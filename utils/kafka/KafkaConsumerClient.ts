import { Consumer, IHeaders, Kafka } from 'kafkajs';

export interface ReceivedMessage {
    topic: string;
    partition: number;
    offset: string;
    key: string | null;
    value: string | null;
    headers: Record<string, string>;
}

export type MessageHandler = (message: ReceivedMessage) => Promise<void> | void;

function headersToStrings(headers: IHeaders | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers ?? {})) {
        if (value === undefined) continue;
        out[name] = Array.isArray(value) ? value.map(v => v.toString()).join(',') : value.toString();
    }
    return out;
}

/**
 * Consumer that records every message it handles, so tests can wait for and inspect them.
 * A message is recorded only after the optional handler finishes, so "received" means "processed".
 */
export class KafkaConsumerClient {
    readonly received: ReceivedMessage[] = [];
    private readonly consumer: Consumer;
    private running = false;

    constructor(kafka: Kafka, readonly groupId: string) {
        this.consumer = kafka.consumer({ groupId, sessionTimeout: 10_000, heartbeatInterval: 1_000, maxWaitTimeInMs: 200 });
    }

    async start(topic: string, options: { fromBeginning?: boolean; handler?: MessageHandler } = {}): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topic, fromBeginning: options.fromBeginning ?? true });
        await this.consumer.run({
            eachMessage: async ({ topic: t, partition, message }) => {
                const received: ReceivedMessage = {
                    topic: t,
                    partition,
                    offset: message.offset,
                    key: message.key?.toString() ?? null,
                    value: message.value?.toString() ?? null,
                    headers: headersToStrings(message.headers),
                };
                if (options.handler) await options.handler(received);
                this.received.push(received);
            },
        });
        this.running = true;
    }

    /** Disconnecting commits the offsets of processed messages for this consumer group. */
    async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        await this.consumer.disconnect();
    }

    /**
     * Polls until `count` messages matching `filter` have been processed, or fails after
     * `timeoutMs` with a summary of what did arrive. Polling, not a fixed sleep.
     */
    async waitForMessages(
        count: number, timeoutMs: number, filter: (m: ReceivedMessage) => boolean = () => true,
    ): Promise<ReceivedMessage[]> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const matching = this.received.filter(filter);
            if (matching.length >= count) return matching;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const summary = this.received.map(m => `p${m.partition}@${m.offset} key=${m.key}`).join(', ') || 'nothing';
        throw new Error(
            `Consumer group "${this.groupId}" expected ${count} matching messages within ${timeoutMs}ms, ` +
            `got ${this.received.filter(filter).length}. Received: ${summary}`);
    }

    /**
     * Waits `quietMs` and returns the count, for asserting that no *extra* messages arrive.
     * Proving absence needs a bounded quiet period; use it only after waitForMessages.
     */
    async countAfterQuietPeriod(quietMs: number): Promise<number> {
        await new Promise(resolve => setTimeout(resolve, quietMs));
        return this.received.length;
    }
}
