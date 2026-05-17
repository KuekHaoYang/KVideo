import 'server-only';

import { Redis } from '@upstash/redis';

type RedisPrimitive = string | number | null;
type RedisRawValue = RedisPrimitive | RedisRawValue[];

export interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

class RedisProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisProtocolError';
  }
}

class TcpRedisClient implements RedisClient {
  private readonly url: URL;

  constructor(redisUrl: string) {
    this.url = new URL(redisUrl);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.command(['GET', key]);
    if (value === null) return null;
    if (typeof value !== 'string') return value as T;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown): Promise<unknown> {
    return this.command(['SET', key, JSON.stringify(value)]);
  }

  async del(key: string): Promise<unknown> {
    return this.command(['DEL', key]);
  }

  async incr(key: string): Promise<number> {
    const value = await this.command(['INCR', key]);
    return typeof value === 'number' ? value : Number(value);
  }

  async expire(key: string, seconds: number): Promise<unknown> {
    return this.command(['EXPIRE', key, String(seconds)]);
  }

  async ttl(key: string): Promise<number> {
    const value = await this.command(['TTL', key]);
    return typeof value === 'number' ? value : Number(value);
  }

  private async command(args: string[]): Promise<RedisRawValue> {
    const setupCommands: string[][] = [];
    const username = decodeUrlPart(this.url.username);
    const password = decodeUrlPart(this.url.password);
    const database = this.url.pathname.replace(/^\//, '');

    if (password) {
      setupCommands.push(username ? ['AUTH', username, password] : ['AUTH', password]);
    }

    if (database) {
      setupCommands.push(['SELECT', database]);
    }

    const responses = await sendRedisCommands(this.url, [
      ...setupCommands,
      args,
      ['QUIT'],
    ]);

    return responses[setupCommands.length] ?? null;
  }
}

let cachedRedis: RedisClient | null | undefined;

function decodeUrlPart(value: string): string {
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isManagedPlatform(): boolean {
  return process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    process.env.CF_PAGES === '1' ||
    Boolean(process.env.CF_PAGES_URL) ||
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) ||
    Boolean(process.env.CF_ACCOUNT_ID) ||
    Boolean(process.env.WORKERS_CI);
}

function getTcpRedisUrl(): string {
  if (isManagedPlatform()) return '';

  return (
    process.env.KVIDEO_REDIS_URL?.trim() ||
    process.env.REDIS_URL?.trim() ||
    ''
  );
}

function encodeCommand(args: string[]): Buffer {
  const parts = [`*${args.length}\r\n`];

  for (const arg of args) {
    parts.push(`$${Buffer.byteLength(arg)}\r\n${arg}\r\n`);
  }

  return Buffer.from(parts.join(''));
}

function readLine(buffer: Buffer, offset: number): { line: string; offset: number } | null {
  const end = buffer.indexOf('\r\n', offset);
  if (end === -1) return null;

  return {
    line: buffer.toString('utf8', offset, end),
    offset: end + 2,
  };
}

function parseResp(buffer: Buffer, offset: number = 0): { value: RedisRawValue; offset: number } | null {
  if (offset >= buffer.length) return null;

  const prefix = String.fromCharCode(buffer[offset]);
  const line = readLine(buffer, offset + 1);
  if (!line) return null;

  switch (prefix) {
    case '+':
      return { value: line.line, offset: line.offset };
    case '-':
      throw new RedisProtocolError(line.line);
    case ':':
      return { value: Number(line.line), offset: line.offset };
    case '$': {
      const length = Number(line.line);
      if (length === -1) return { value: null, offset: line.offset };

      const valueStart = line.offset;
      const valueEnd = valueStart + length;
      const nextOffset = valueEnd + 2;
      if (nextOffset > buffer.length) return null;

      return {
        value: buffer.toString('utf8', valueStart, valueEnd),
        offset: nextOffset,
      };
    }
    case '*': {
      const length = Number(line.line);
      if (length === -1) return { value: null, offset: line.offset };

      const values: RedisRawValue[] = [];
      let cursor = line.offset;
      for (let index = 0; index < length; index += 1) {
        const parsed = parseResp(buffer, cursor);
        if (!parsed) return null;

        values.push(parsed.value);
        cursor = parsed.offset;
      }

      return { value: values, offset: cursor };
    }
    default:
      throw new RedisProtocolError(`Unsupported Redis response prefix: ${prefix}`);
  }
}

async function sendRedisCommands(redisUrl: URL, commands: string[][]): Promise<RedisRawValue[]> {
  const useTls = redisUrl.protocol === 'rediss:';
  const host = redisUrl.hostname || '127.0.0.1';
  const port = Number(redisUrl.port || (useTls ? 6380 : 6379));
  const timeout = Number(process.env.KVIDEO_REDIS_CONNECT_TIMEOUT_MS || 5000);
  const payload = Buffer.concat(commands.map(encodeCommand));
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      callback();
    };

    const onReady = (): void => {
      socket.write(payload);
    };

    let socket: import('node:net').Socket;

    if (useTls) {
      import('node:tls')
        .then(({ connect }) => {
          socket = connect({ host, port, servername: host }, onReady);
          bindSocketHandlers(socket);
        })
        .catch((error: unknown) => finish(() => reject(error)));
    } else {
      import('node:net')
        .then(({ connect }) => {
          socket = connect({ host, port }, onReady);
          bindSocketHandlers(socket);
        })
        .catch((error: unknown) => finish(() => reject(error)));
    }

    function bindSocketHandlers(activeSocket: import('node:net').Socket): void {
      activeSocket.setTimeout(timeout);

      activeSocket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      activeSocket.on('timeout', () => {
        activeSocket.destroy(new Error(`Redis command timed out after ${timeout}ms`));
      });

      activeSocket.on('error', (error) => {
        finish(() => reject(error));
      });

      activeSocket.on('close', (hadError) => {
        if (hadError) return;

        finish(() => {
          try {
            const buffer = Buffer.concat(chunks);
            const responses: RedisRawValue[] = [];
            let offset = 0;

            while (offset < buffer.length) {
              const parsed = parseResp(buffer, offset);
              if (!parsed) {
                throw new RedisProtocolError('Incomplete Redis response');
              }

              responses.push(parsed.value);
              offset = parsed.offset;
            }

            resolve(responses);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  });
}

export function getRedisClient(): RedisClient | null {
  if (cachedRedis !== undefined) {
    return cachedRedis;
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    cachedRedis = Redis.fromEnv() as RedisClient;
    return cachedRedis;
  }

  const tcpRedisUrl = getTcpRedisUrl();
  if (tcpRedisUrl) {
    cachedRedis = new TcpRedisClient(tcpRedisUrl);
    return cachedRedis;
  }

  cachedRedis = null;
  return cachedRedis;
}

export function resetRedisClientForTests(): void {
  cachedRedis = undefined;
}
