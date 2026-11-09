import { IHeaders, Kafka, Partitioners, Producer } from 'kafkajs';
import { OrderEvent } from './orderEvent';

export interface SentRecord {
    partition: number;
    offset: string;
}

/**
 * Producer configured like a production one: idempotent, acks=all (-1).
 * Events are keyed by orderId so every event for one order lands on the same partition.
 */
export class KafkaProducerClient {
    private readonly producer: Producer;

    constructor(kafka: Kafka) {
        this.producer = kafka.producer({
            idempotent: true,
            maxInFlightRequests: 1,
            createPartitioner: Partitioners.DefaultPartitioner,
        });
    }

    async connect(): Promise<void> {
        await this.producer.connect();
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    async sendEvent(topic: string, event: OrderEvent, headers: IHeaders = {}): Promise<SentRecord> {
        return this.sendRaw(topic, event.orderId, JSON.stringify(event), { 'event-type': event.eventType, ...headers });
    }

    /** Sends events one at a time, so the broker receives them in array order. */
    async sendEvents(topic: string, events: OrderEvent[]): Promise<SentRecord[]> {
        const records: SentRecord[] = [];
        for (const event of events) records.push(await this.sendEvent(topic, event));
        return records;
    }

    /** Sends an arbitrary value. Used for malformed messages and dead-letter records. */
    async sendRaw(topic: string, key: string | null, value: string | Buffer | null, headers: IHeaders = {}): Promise<SentRecord> {
        const [metadata] = await this.producer.send({
            topic,
            acks: -1,
            messages: [{ key, value, headers }],
        });
        return { partition: metadata.partition, offset: metadata.baseOffset ?? metadata.offset ?? '' };
    }
}
