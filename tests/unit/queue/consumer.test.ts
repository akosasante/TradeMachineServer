import amqp from "amqplib";
import "jest";
import "jest-extended";
import { MessageConsumer } from "../../../src/queue/consumer";

describe("Consumer class", () => {
    const mockConn = jest.fn();
    const mockCh = {
        prefetch: jest.fn(),
        consume: jest.fn(),
        ack: jest.fn(),
        assertQueue: jest.fn().mockResolvedValue({
            queue: "foobar",
            messageCount: 0,
            consumerCount: 0,
        }),
    };

    afterEach(async () => {
        Object.keys(mockCh).forEach((action: string) => {
            // @ts-ignore
            (mockCh[action] as jest.Mock).mockClear();
        });
    });

    it("should allow creating a new consumer on a given connection and channel", async () => {
        const consumer = await MessageConsumer.createConsumer(
            mockConn as unknown as amqp.Connection,
            mockCh as unknown as amqp.Channel);

        expect(consumer).toBeInstanceOf(MessageConsumer);
        expect(mockCh.prefetch).toBeCalledTimes(1);
        expect(mockCh.prefetch).toHaveBeenCalledWith(2);
    });

    describe("instance methods", () => {
        const consumerInstance = new MessageConsumer(
            mockConn as unknown as amqp.Connection,
            mockCh as unknown as amqp.Channel);

        it("consumeMesssagesOn - should consume on the instances channel, call the callback,\ " +
            "then ack the message", async () => {
            const testData = {key: "value", key2: "value_2"};
            const producedData = {content: Buffer.from(JSON.stringify(testData))};
            mockCh.consume.mockImplementationOnce((queue, cb) => cb(producedData));
            const fn = jest.fn();
            const queueName = "test_queue";
            await consumerInstance.consumeMessagesOn(queueName, fn);

            expect(mockCh.assertQueue).toHaveBeenCalledTimes(1);
            expect(mockCh.assertQueue).toHaveBeenCalledWith(queueName, {durable: true});
            expect(mockCh.consume).toBeCalledTimes(1);
            expect(mockCh.consume).toHaveBeenCalledWith(queueName, expect.toBeFunction());
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith(testData);
            expect(mockCh.ack).toHaveBeenCalledTimes(1);
            expect(mockCh.ack).toHaveBeenCalledWith(producedData);
        });
        it("consumeMessagesOn - should not call the callback if there's no data", async () => {
            const fn = jest.fn();
            const queueName = "test_queue";
            await consumerInstance.consumeMessagesOn(queueName, fn);

            expect(mockCh.assertQueue).toHaveBeenCalledTimes(1);
            expect(mockCh.assertQueue).toHaveBeenCalledWith(queueName, {durable: true});
            expect(mockCh.consume).toBeCalledTimes(1);
            expect(mockCh.consume).toHaveBeenCalledWith(queueName, expect.toBeFunction());
            expect(fn).not.toHaveBeenCalled();
            expect(mockCh.ack).not.toHaveBeenCalled();
        });
    });
});
