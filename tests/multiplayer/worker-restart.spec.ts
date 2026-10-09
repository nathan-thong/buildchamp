import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { rm } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const WORKER_URL = 'http://127.0.0.1:4176';

test('local Worker restart restores versioned lobby and draft state from SQLite', async ({
  page,
}) => {
  const workspacePath = resolve('.');
  const persistencePath = resolve('.wrangler', `multiplayer-restart-${randomUUID()}`);
  const relativePersistencePath = relative(workspacePath, persistencePath);
  if (
    !relativePersistencePath ||
    relativePersistencePath === '..' ||
    relativePersistencePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePersistencePath)
  ) {
    throw new Error('The test Durable Object store must remain inside the workspace.');
  }

  let worker: LocalWorker | undefined;
  try {
    worker = await startWorker(persistencePath);
    await page.goto(WORKER_URL);
    const session = await page.evaluate(async () => {
      type EventEnvelope = {
        protocolVersion: number;
        revision: number;
        type: string;
        payload: Record<string, unknown>;
      };
      type Join = {
        participantId: string;
        reconnectToken: string;
        socketPath: string;
        roomCode?: string;
      };
      type Client = {
        socket: WebSocket;
        projection: Record<string, unknown> | null;
        waitFor: (
          predicate: (event: EventEnvelope) => boolean,
          after?: number,
        ) => Promise<EventEnvelope>;
        latestSequence: () => number;
      };

      const createResponse = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolVersion: 1, nickname: 'Restart Host' }),
      });
      const hostJoin = (await createResponse.json()) as Join;
      if (!createResponse.ok) throw new Error(`Room create failed with ${createResponse.status}.`);
      const host = await connect(hostJoin);
      await host.waitFor((event) => event.type === 'lobby.snapshot');

      const joinResponse = await fetch(`/api/rooms/${hostJoin.roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolVersion: 1, nickname: 'Restart Player' }),
      });
      const playerJoin = (await joinResponse.json()) as Join;
      if (!joinResponse.ok) throw new Error(`Player join failed with ${joinResponse.status}.`);
      const player = await connect(playerJoin);
      const initialPlayer = await player.waitFor((event) => event.type === 'lobby.snapshot');
      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision >= initialPlayer.revision,
      );

      const hostReady = await sendCommand(host, 'host-ready', 'player.ready', { ready: true });
      await player.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision >= hostReady.revision,
      );
      const playerReady = await sendCommand(player, 'player-ready', 'player.ready', {
        ready: true,
      });
      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision >= playerReady.revision,
      );
      const started = await sendCommand(host, 'start', 'host.start', {});
      const hostDraft = await host.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= started.revision &&
          event.payload.phase === 'drafting',
      );
      const playerDraft = await player.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= started.revision &&
          event.payload.phase === 'drafting',
      );

      return {
        roomCode: hostJoin.roomCode,
        hostJoin,
        playerJoin,
        beforeRestart: {
          phase: hostDraft.payload.phase,
          hostOfferId: (hostDraft.payload.offer as { id?: string } | undefined)?.id,
          playerOfferId: (playerDraft.payload.offer as { id?: string } | undefined)?.id,
          revision: hostDraft.revision,
        },
      };

      async function connect(join: Join): Promise<Client> {
        const url = new URL(join.socketPath, location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(url, [
          'buildchamp.v1',
          `participant.${join.participantId}`,
          `token.${join.reconnectToken}`,
        ]);
        const messages: Array<{ sequence: number; event: EventEnvelope }> = [];
        const waiters: Array<{
          predicate: (event: EventEnvelope) => boolean;
          after: number;
          resolve: (event: EventEnvelope) => void;
          timer: number;
        }> = [];
        let sequence = 0;
        const client: Client = {
          socket,
          projection: null,
          latestSequence: () => sequence,
          waitFor: (predicate, after = 0) => {
            const existing = messages.find(
              (entry) => entry.sequence > after && predicate(entry.event),
            );
            if (existing) return Promise.resolve(existing.event);
            return new Promise((resolve, reject) => {
              const waiter = {
                predicate,
                after,
                resolve,
                timer: window.setTimeout(
                  () => reject(new Error('Timed out waiting for a persisted lobby event.')),
                  8_000,
                ),
              };
              waiters.push(waiter);
            });
          },
        };
        socket.addEventListener('message', (message) => {
          const event = JSON.parse(String(message.data)) as EventEnvelope;
          sequence += 1;
          messages.push({ sequence, event });
          if (event.type === 'lobby.snapshot') client.projection = event.payload;
          for (let index = waiters.length - 1; index >= 0; index -= 1) {
            const waiter = waiters[index];
            if (waiter && sequence > waiter.after && waiter.predicate(event)) {
              window.clearTimeout(waiter.timer);
              waiters.splice(index, 1);
              waiter.resolve(event);
            }
          }
        });
        await new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => resolve(), { once: true });
          socket.addEventListener(
            'error',
            () => reject(new Error('The persisted lobby WebSocket was rejected.')),
            { once: true },
          );
        });
        if (socket.protocol !== 'buildchamp.v1') {
          throw new Error('The Worker negotiated an unexpected protocol after restart.');
        }
        return client;
      }

      async function sendCommand(
        client: Client,
        commandId: string,
        type: string,
        payload: Record<string, unknown>,
      ): Promise<EventEnvelope> {
        const roomRevision = client.projection?.revision as number;
        const sequence = client.latestSequence();
        client.socket.send(
          JSON.stringify({ protocolVersion: 1, commandId, roomRevision, type, payload }),
        );
        const ack = await client.waitFor(
          (event) => event.type === 'command.ack' && event.payload.commandId === commandId,
          sequence,
        );
        await client.waitFor(
          (event) => event.type === 'lobby.snapshot' && event.revision > roomRevision,
          sequence,
        );
        return ack;
      }
    });

    expect(session.beforeRestart.phase).toBe('drafting');
    expect(session.beforeRestart.hostOfferId).toBe(session.beforeRestart.playerOfferId);

    await stopWorker(worker);
    worker = undefined;
    await waitForWorkerDown();
    worker = await startWorker(persistencePath);
    await page.goto(WORKER_URL);
    const afterRestart = await page.evaluate(async (savedSession) => {
      type EventEnvelope = {
        revision: number;
        type: string;
        payload: Record<string, unknown>;
      };
      type Join = {
        participantId: string;
        reconnectToken: string;
        socketPath: string;
      };
      const infoResponse = await fetch(`/api/rooms/${savedSession.roomCode}`);
      const info = (await infoResponse.json()) as { phase: string; playerCount: number };
      if (!infoResponse.ok) throw new Error(`Persisted room info returned ${infoResponse.status}.`);
      const host = await connect(savedSession.hostJoin);
      const player = await connect(savedSession.playerJoin);
      const hostSnapshot = await host.waitFor((event) => event.type === 'lobby.snapshot');
      const playerSnapshot = await player.waitFor((event) => event.type === 'lobby.snapshot');
      const hostOffer = hostSnapshot.payload.offer as { id?: string } | undefined;
      const playerOffer = playerSnapshot.payload.offer as { id?: string } | undefined;
      host.socket.close();
      player.socket.close();
      return {
        info,
        host: hostSnapshot.payload,
        player: playerSnapshot.payload,
        hostOfferId: hostOffer?.id,
        playerOfferId: playerOffer?.id,
        protocolVersions: [
          hostSnapshot.payload.protocolVersion,
          playerSnapshot.payload.protocolVersion,
        ],
      };

      async function connect(join: Join) {
        const url = new URL(join.socketPath, location.href);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(url, [
          'buildchamp.v1',
          `participant.${join.participantId}`,
          `token.${join.reconnectToken}`,
        ]);
        const messages: EventEnvelope[] = [];
        const waiters: Array<{
          predicate: (event: EventEnvelope) => boolean;
          resolve: (event: EventEnvelope) => void;
          timer: number;
        }> = [];
        const client = {
          socket,
          waitFor: (predicate: (event: EventEnvelope) => boolean) => {
            const existing = messages.find(predicate);
            if (existing) return Promise.resolve(existing);
            return new Promise<EventEnvelope>((resolve, reject) => {
              const waiter = {
                predicate,
                resolve,
                timer: window.setTimeout(
                  () => reject(new Error('Timed out waiting for a restored lobby snapshot.')),
                  8_000,
                ),
              };
              waiters.push(waiter);
            });
          },
        };
        socket.addEventListener('message', (message) => {
          const event = JSON.parse(String(message.data)) as EventEnvelope;
          messages.push(event);
          for (let index = waiters.length - 1; index >= 0; index -= 1) {
            const waiter = waiters[index];
            if (waiter && waiter.predicate(event)) {
              window.clearTimeout(waiter.timer);
              waiters.splice(index, 1);
              waiter.resolve(event);
            }
          }
        });
        await new Promise<void>((resolve, reject) => {
          socket.addEventListener('open', () => resolve(), { once: true });
          socket.addEventListener(
            'error',
            () => reject(new Error('Reconnect failed after Worker restart.')),
            { once: true },
          );
        });
        if (socket.protocol !== 'buildchamp.v1') {
          throw new Error('The Worker negotiated an unexpected protocol after restart.');
        }
        return client;
      }
    }, session);

    expect(afterRestart.info).toMatchObject({ phase: 'drafting', playerCount: 2 });
    expect(afterRestart.host).toMatchObject({
      phase: 'drafting',
      selfParticipantId: session.hostJoin.participantId,
      currentRound: 1,
    });
    expect(afterRestart.player).toMatchObject({
      phase: 'drafting',
      selfParticipantId: session.playerJoin.participantId,
      currentRound: 1,
    });
    expect(afterRestart.hostOfferId).toBe(session.beforeRestart.hostOfferId);
    expect(afterRestart.playerOfferId).toBe(session.beforeRestart.playerOfferId);
    expect(afterRestart.hostOfferId).toBe(afterRestart.playerOfferId);
    expect(afterRestart.protocolVersions).toEqual([1, 1]);
  } finally {
    if (worker) {
      await stopWorker(worker);
      await waitForWorkerDown();
    }
    await rm(persistencePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

type LocalWorker = { child: ChildProcess; output: () => string };

async function startWorker(persistencePath: string): Promise<LocalWorker> {
  const wranglerPath = resolve('node_modules/wrangler/bin/wrangler.js');
  const child = spawn(
    process.execPath,
    [
      wranglerPath,
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      '4176',
      '--persist-to',
      persistencePath,
      '--show-interactive-dev-session=false',
    ],
    {
      cwd: resolve('.'),
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const appendOutput = (chunk: Buffer) => {
    output = `${output}${chunk.toString('utf8')}`.slice(-4_000);
  };
  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);
  const worker = { child, output: () => output };

  const startTime = Date.now();
  while (Date.now() - startTime < 45_000) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler exited before starting: ${output}`);
    }
    try {
      const response = await fetch(WORKER_URL);
      if (response.ok) return worker;
    } catch {
      // Wrangler is still starting the local Worker.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await stopWorker(worker);
  throw new Error(`Wrangler did not start the local Worker: ${output}`);
}

async function stopWorker(worker: LocalWorker): Promise<void> {
  if (worker.child.exitCode !== null) return;
  const exited = once(worker.child, 'exit');
  if (process.platform === 'win32' && worker.child.pid) {
    const result = spawnSync('taskkill', ['/PID', String(worker.child.pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0 && worker.child.exitCode === null) {
      throw new Error(`Could not stop the isolated Wrangler process: ${result.stderr}`);
    }
  } else {
    if (worker.child.pid) {
      process.kill(-worker.child.pid, 'SIGTERM');
    } else {
      worker.child.kill('SIGTERM');
    }
  }
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      exited,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Timed out stopping the isolated Wrangler process.')),
          10_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForWorkerDown(): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < 10_000) {
    try {
      await fetch(WORKER_URL);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The previous Wrangler process still serves the restart-test port.');
}
