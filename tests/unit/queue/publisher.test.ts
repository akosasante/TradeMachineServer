import amqp from "amqplib";
import "jest";
import "jest-extended";
import { MessagePublisher } from "../../../src/queue/publisher";

describe("Publisher class", () => {
    const mockConn = jest.fn();
    const mockCh = {
        sendToQueue: jest.fn(),
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

    it("should allow creating a new publisher on a given connection and channel", async () => {
        const publisher = await MessagePublisher.createPublisher(
            mockConn as unknown as amqp.Connection,
            mockCh as unknown as amqp.Channel);

        expect(publisher).toBeInstanceOf(MessagePublisher);
    });

    describe("instance methods", () => {
        const publisherInstance = new MessagePublisher(
            mockConn as unknown as amqp.Connection,
            mockCh as unknown as amqp.Channel);

        it("sendMessage - should produce to the instances channel", async () => {
            const queueName = "test_queue";
            const message = "{'key': 'value', 'key2': 'value_2'}";
            await publisherInstance.sendMessage(queueName, message);

            expect(mockCh.assertQueue).toHaveBeenCalledTimes(1);
            expect(mockCh.assertQueue).toHaveBeenCalledWith(queueName, {durable: true});
            expect(mockCh.sendToQueue).toHaveBeenCalledTimes(1);
            expect(mockCh.sendToQueue).toHaveBeenCalledWith(queueName, Buffer.from(message), {
                persistent: true,
                contentType: "application/json",
            });
        });
    });
});
