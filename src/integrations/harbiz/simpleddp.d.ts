// Type declaration for simpleddp (no @types package available)
declare module "simpleddp" {
  interface SimpleDDPOptions {
    endpoint: string;
    SocketConstructor: unknown;
    reconnectInterval?: number;
    autoConnect?: boolean;
    autoReconnect?: boolean;
  }

  class SimpleDDP {
    constructor(options: SimpleDDPOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    call(method: string, ...args: unknown[]): Promise<unknown>;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb: (...args: unknown[]) => void): void;
  }

  export = SimpleDDP;
}
