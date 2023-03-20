import { Client, connect, Queue } from 'haremq';
import { inject, injectable } from 'inversify';

import { IDENTIFIERS } from '@/container/identifiers';
import { compress, decompress } from '@/utils/gzipUtils';

import {
  MessageInterface,
  MessageQueueAdapterInterface,
  QueueOptions,
} from '../messageQueueAdapterInterface';

const defaultOptions: QueueOptions = {
  autoAcknowledgement: false,
  maxRetries: 10,
  parallelMessages: 4,
};

@injectable()
export class RabbitMQ implements MessageQueueAdapterInterface {
  private client: Client;
  private queueCache: { [queueName: string]: Queue } = {};
  private options: QueueOptions;

  constructor(
    @inject(IDENTIFIERS.MessageQueueOptions)
    options?: QueueOptions,
  ) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
  }

  private async getQueue(queueName: string): Promise<Queue> {
    if (queueName in this.queueCache) {
      return this.queueCache[queueName];
    }
    const queue = await this.client.queue(queueName, { durable: true });
    this.queueCache[queueName] = queue;
    return queue;
  }

  async connect(connectionString: string) {
    this.client = await connect(connectionString);
    this.client.setPrefetchCount(this.options.parallelMessages!);
    console.log('rabbitmq connected');
  }

  async consume<T extends object>(
    queueName: string,
    callback: (message: T) => Promise<void>,
  ) {
    const queue = await this.getQueue(queueName);
    queue.consume(
      async (message, done) => {
        const newMessage = message as MessageInterface;
        if (newMessage.isCompressed) {
          newMessage.data = await decompress(newMessage.data as string);
        }
        try {
          await callback(newMessage.data as T);
          done();
        } catch (err: any) {
          console.log(err.message);
          done();
          if (newMessage.currentTry < this.options.maxRetries!) {
            this.send(
              queueName,
              newMessage.data,
              newMessage.isCompressed,
              newMessage.currentTry,
            );
          }
        }
      },
      { noAck: this.options.autoAcknowledgement },
    );
  }

  async send(
    queueName: string,
    message: object | string,
    useCompression: boolean = false,
    currentTry: number = 0,
  ): Promise<void> {
    const queue = await this.getQueue(queueName);
    const messageObject: MessageInterface = {
      isCompressed: useCompression,
      currentTry: currentTry + 1,
      data: useCompression ? await compress(message as object) : message,
    };
    queue.publish(messageObject, {});
  }

  get isConnected(): boolean {
    return this.client.isAlive;
  }
}
