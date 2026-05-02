import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import {
  getRedisClient,
  resetRedisClientForTests,
} from '@/lib/server/redis-client';

function encodeSimple(value: string): string {
  return `+${value}\r\n`;
}

function encodeInteger(value: number): string {
  return `:${value}\r\n`;
}

function encodeBulk(value: string | null): string {
  if (value === null) return '$-1\r\n';
  return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
}

function parseCommands(buffer: Buffer): string[][] {
  const commands: string[][] = [];
  let offset = 0;

  while (offset < buffer.length) {
    assert.equal(String.fromCharCode(buffer[offset]), '*');
    const commandLineEnd = buffer.indexOf('\r\n', offset);
    const itemCount = Number(buffer.toString('utf8', offset + 1, commandLineEnd));
    offset = commandLineEnd + 2;

    const command: string[] = [];
    for (let index = 0; index < itemCount; index += 1) {
      assert.equal(String.fromCharCode(buffer[offset]), '$');
      const lengthLineEnd = buffer.indexOf('\r\n', offset);
      const length = Number(buffer.toString('utf8', offset + 1, lengthLineEnd));
      const valueStart = lengthLineEnd + 2;
      const valueEnd = valueStart + length;
      command.push(buffer.toString('utf8', valueStart, valueEnd));
      offset = valueEnd + 2;
    }

    commands.push(command);
  }

  return commands;
}

async function withFakeRedis(
  callback: (url: string, seenCommands: string[][]) => Promise<void>,
): Promise<void> {
  const data = new Map<string, string>();
  const seenCommands: string[][] = [];

  const server = createServer((socket: Socket) => {
    socket.on('data', (chunk) => {
      for (const command of parseCommands(chunk)) {
        seenCommands.push(command);
        const [name, ...args] = command;

        switch (name.toUpperCase()) {
          case 'AUTH':
          case 'SELECT':
            socket.write(encodeSimple('OK'));
            break;
          case 'SET':
            data.set(args[0], args[1]);
            socket.write(encodeSimple('OK'));
            break;
          case 'GET':
            socket.write(encodeBulk(data.get(args[0]) ?? null));
            break;
          case 'INCR': {
            const next = Number(data.get(args[0]) || 0) + 1;
            data.set(args[0], String(next));
            socket.write(encodeInteger(next));
            break;
          }
          case 'EXPIRE':
            socket.write(encodeInteger(data.has(args[0]) ? 1 : 0));
            break;
          case 'TTL':
            socket.write(encodeInteger(data.has(args[0]) ? -1 : -2));
            break;
          case 'DEL': {
            const deleted = data.delete(args[0]);
            socket.write(encodeInteger(deleted ? 1 : 0));
            break;
          }
          case 'QUIT':
            socket.write(encodeSimple('OK'));
            socket.end();
            break;
          default:
            socket.write(`-ERR unsupported command ${name}\r\n`);
        }
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    await callback(`redis://:secret@127.0.0.1:${address.port}/1`, seenCommands);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test('TCP Redis client supports Docker-style redis:// storage', async () => {
  await withFakeRedis(async (url, seenCommands) => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.REDIS_URL = url;
    resetRedisClientForTests();

    const redis = getRedisClient();
    assert.ok(redis);

    await redis.set('account', { username: 'admin', role: 'super_admin' });
    assert.deepEqual(await redis.get('account'), {
      username: 'admin',
      role: 'super_admin',
    });

    assert.equal(await redis.incr('auth:throttle:test'), 1);
    assert.equal(await redis.ttl('auth:throttle:test'), -1);
    assert.equal(await redis.del('auth:throttle:test'), 1);
    assert.equal(await redis.get('missing'), null);

    assert.deepEqual(seenCommands.slice(0, 3), [
      ['AUTH', 'secret'],
      ['SELECT', '1'],
      ['SET', 'account', '{"username":"admin","role":"super_admin"}'],
    ]);
  });

  delete process.env.REDIS_URL;
  resetRedisClientForTests();
});
