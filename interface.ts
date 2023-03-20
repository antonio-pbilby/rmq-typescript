export interface QueueOptions {
  autoAcknowledgement?: boolean;
  maxRetries?: number;
  parallelMessages?: number;
}

export type RabbitMQConnected = boolean;

export interface MessageQueueAdapterInterface {
  connect(connectionString: string): Promise<void>;
  consume<T extends object>(
    queueName: string,
    callback: (message: T) => Promise<void>,
  ): Promise<void>;
  send(queueName: string, message: any): Promise<void>;
  get isConnected(): boolean;
}

export interface MessageInterface {
  currentTry: number;
  isCompressed: boolean;
  data: object | string;
}
