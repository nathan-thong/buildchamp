import { expect, test } from '@playwright/test';

test('local Durable Object authorizes, persists, projects and reconnects lobby sessions', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    type Envelope = {
      protocolVersion: number;
      type: string;
      revision: number;
      payload: Record<string, unknown>;
    };
    type Join = {
      participantId: string;
      reconnectToken: string;
      socketPath: string;
    };
    type Client = {
      socket: WebSocket;
      messages: Array<{ sequence: number; event: Envelope }>;
      projection: Record<string, unknown> | null;
      waitFor: (predicate: (event: Envelope) => boolean, after?: number) => Promise<Envelope>;
      latestSequence: () => number;
    };

    const createResponse = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolVersion: 1, nickname: 'Host One' }),
    });
    const hostJoin = (await createResponse.json()) as Join & { roomCode: string; role: string };
    if (!createResponse.ok) throw new Error(`Room create failed with ${createResponse.status}.`);

    const host = await connect(hostJoin);
    const hostInitial = await host.waitFor((event) => event.type === 'lobby.snapshot');
    const hostProjection = hostInitial.payload;

    const joinResponse = await fetch(`/api/rooms/${hostJoin.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolVersion: 1, nickname: 'Player Two', role: 'player' }),
    });
    const playerJoin = (await joinResponse.json()) as Join & { role: string };
    if (!joinResponse.ok) throw new Error(`Join failed with ${joinResponse.status}.`);
    const player = await connect(playerJoin);
    const playerInitial = await player.waitFor((event) => event.type === 'lobby.snapshot');
    const displayResponse = await fetch(`/api/rooms/${hostJoin.roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolVersion: 1, role: 'display' }),
    });
    const displayJoin = (await displayResponse.json()) as Join & { role: string };
    if (!displayResponse.ok) throw new Error(`Display join failed with ${displayResponse.status}.`);
    const display = await connect(displayJoin);
    const displayInitial = await display.waitFor((event) => event.type === 'lobby.snapshot');
    await host.waitFor(
      (event) => event.type === 'lobby.snapshot' && event.revision >= playerInitial.revision,
    );
    await host.waitFor(
      (event) => event.type === 'lobby.snapshot' && event.revision >= displayInitial.revision,
    );
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));

    const wrongTokenRejected = await rejectsSocket({
      participantId: hostJoin.participantId,
      reconnectToken: 'x'.repeat(43),
      socketPath: hostJoin.socketPath,
    });

    const escalationRevision = player.projection?.revision as number;
    const escalationSequence = player.latestSequence();
    const escalationId = 'player-settings-attack';
    player.socket.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: escalationId,
        roomRevision: escalationRevision,
        type: 'host.settings',
        payload: { mode: 'random', speed: 'quick', revealOrder: 'all-at-once' },
      }),
    );
    const escalation = await player.waitFor(
      (event) => event.type === 'lobby.error' && event.payload.commandId === escalationId,
      escalationSequence,
    );

    const oversizedSequence = player.latestSequence();
    player.socket.send('x'.repeat(4097));
    const oversized = await player.waitFor(
      (event) => event.type === 'lobby.error' && event.payload.code === 'invalid_command',
      oversizedSequence,
    );

    const malformedSequence = player.latestSequence();
    player.socket.send(JSON.stringify({ protocolVersion: 1, type: 'host.start' }));
    const malformed = await player.waitFor(
      (event) => event.type === 'lobby.error' && event.payload.code === 'invalid_command',
      malformedSequence,
    );

    const settingsRevision = host.projection?.revision as number;
    const settings = await sendCommand(host, {
      commandId: 'host-settings',
      roomRevision: settingsRevision,
      type: 'host.settings',
      payload: { mode: 'random', speed: 'standard', revealOrder: 'staged' },
    });
    await player.waitFor(
      (event) => event.type === 'lobby.snapshot' && event.revision >= settings.revision,
    );

    const playerReady = await sendCommand(player, {
      commandId: 'player-ready',
      roomRevision: player.projection?.revision as number,
      type: 'player.ready',
      payload: { ready: true },
    });
    const duplicateSequence = player.latestSequence();
    player.socket.send(
      JSON.stringify({
        protocolVersion: 1,
        commandId: 'player-ready',
        roomRevision: playerReady.revision - 1,
        type: 'player.ready',
        payload: { ready: true },
      }),
    );
    const duplicate = await player.waitFor(
      (event) => event.type === 'command.ack' && event.payload.commandId === 'player-ready',
      duplicateSequence,
    );
    await host.waitFor(
      (event) => event.type === 'lobby.snapshot' && event.revision >= playerReady.revision,
    );

    const hostReady = await sendCommand(host, {
      commandId: 'host-ready',
      roomRevision: host.projection?.revision as number,
      type: 'player.ready',
      payload: { ready: true },
    });
    await player.waitFor(
      (event) => event.type === 'lobby.snapshot' && event.revision >= hostReady.revision,
    );

    const started = await sendCommand(host, {
      commandId: 'host-start',
      roomRevision: host.projection?.revision as number,
      type: 'host.start',
      payload: {},
    });
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
    const displayDraft = await display.waitFor(
      (event) =>
        event.type === 'lobby.snapshot' &&
        event.revision >= started.revision &&
        event.payload.phase === 'drafting',
    );
    const hostOfferId = (hostDraft.payload.offer as { id?: string } | undefined)?.id ?? '';
    const playerOfferId = (playerDraft.payload.offer as { id?: string } | undefined)?.id ?? '';
    const hostProjectionJson = JSON.stringify(hostDraft.payload);
    const playerProjectionJson = JSON.stringify(playerDraft.payload);
    const playerContainsHostToken = playerProjectionJson.includes(hostJoin.reconnectToken);
    const displayProjectionJson = JSON.stringify(displayDraft.payload);
    const publicDisplayOffers = displayDraft.payload.offersByPlayer as
      Array<{ offer: Record<string, unknown> }> | undefined;
    const displayOnlySeesChampionIdentity = Boolean(
      publicDisplayOffers?.length === 2 &&
      publicDisplayOffers.every(({ offer }) => Object.keys(offer).join(',') === 'champion') &&
      !displayProjectionJson.includes('variant') &&
      !displayProjectionJson.includes('components') &&
      !displayProjectionJson.includes('selectableSlots'),
    );

    const rateLimitSequence = display.latestSequence();
    for (let index = 0; index < 25; index += 1) display.socket.send('x');
    const rateLimited = await display.waitFor(
      (event) => event.type === 'lobby.error' && event.payload.code === 'rate_limited',
      rateLimitSequence,
    );

    host.socket.close();
    const migrated = await player.waitFor(
      (event) =>
        event.type === 'lobby.snapshot' &&
        event.payload.hostParticipantId === playerJoin.participantId &&
        event.payload.role === 'host',
    );

    const reconnectedHost = await connect(hostJoin);
    const restored = await reconnectedHost.waitFor((event) => event.type === 'lobby.snapshot');
    const infoResponse = await fetch(`/api/rooms/${hostJoin.roomCode}`);
    const info = (await infoResponse.json()) as {
      phase: string;
      playerCount: number;
      protocolVersion: number;
    };
    player.socket.close();
    reconnectedHost.socket.close();
    display.socket.close();

    return {
      created: createResponse.status,
      joined: joinResponse.status,
      initialRole: hostProjection.role,
      wrongTokenRejected,
      escalationCode: escalation.payload.code,
      oversizedCode: oversized.payload.code,
      malformedCode: malformed.payload.code,
      rateLimitCode: rateLimited.payload.code,
      duplicate: duplicate.payload.duplicate,
      draftingPhase: hostDraft.payload.phase,
      roleScopedOffers:
        Boolean(hostOfferId && playerOfferId) &&
        !hostProjectionJson.includes('offersByPlayer') &&
        !playerProjectionJson.includes('offersByPlayer'),
      displayOnlySeesChampionIdentity,
      privateTokenAbsent: !playerContainsHostToken,
      migratedHostId: migrated.payload.hostParticipantId,
      restoredParticipantId: restored.payload.selfParticipantId,
      hostId: hostJoin.participantId,
      playerId: playerJoin.participantId,
      protocolVersion: hostDraft.protocolVersion,
      infoProtocolVersion: info.protocolVersion,
      info,
    };

    async function connect(join: Join): Promise<Client> {
      const socketUrl = new URL(join.socketPath, location.href);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(socketUrl, [
        'buildchamp.v1',
        `participant.${join.participantId}`,
        `token.${join.reconnectToken}`,
      ]);
      const messages: Client['messages'] = [];
      const waiters: Array<{
        predicate: (event: Envelope) => boolean;
        after: number;
        resolve: (event: Envelope) => void;
        timer: number;
      }> = [];
      let sequence = 0;
      const client: Client = {
        socket,
        messages,
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
                () => reject(new Error('Timed out waiting for a lobby event.')),
                8_000,
              ),
            };
            waiters.push(waiter);
          });
        },
      };
      socket.addEventListener('message', (message) => {
        const event = JSON.parse(String(message.data)) as Envelope;
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
          () => reject(new Error('WebSocket connection was rejected.')),
          { once: true },
        );
      });
      if (socket.protocol !== 'buildchamp.v1')
        throw new Error('Server negotiated an unexpected WebSocket protocol.');
      return client;
    }

    async function rejectsSocket(join: Join): Promise<boolean> {
      const socketUrl = new URL(join.socketPath, location.href);
      socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(socketUrl, [
        'buildchamp.v1',
        `participant.${join.participantId}`,
        `token.${join.reconnectToken}`,
      ]);
      return new Promise((resolve) => {
        let opened = false;
        const timer = window.setTimeout(() => {
          socket.close();
          resolve(!opened);
        }, 4_000);
        socket.addEventListener(
          'open',
          () => {
            opened = true;
            window.clearTimeout(timer);
            socket.close();
            resolve(false);
          },
          { once: true },
        );
        socket.addEventListener(
          'close',
          () => {
            window.clearTimeout(timer);
            resolve(!opened);
          },
          { once: true },
        );
        socket.addEventListener('error', () => undefined, { once: true });
      });
    }

    async function sendCommand(
      client: Client,
      command: {
        commandId: string;
        roomRevision: number;
        type: string;
        payload: Record<string, unknown>;
      },
    ): Promise<Envelope> {
      const sequence = client.latestSequence();
      client.socket.send(JSON.stringify({ protocolVersion: 1, ...command }));
      const ack = await client.waitFor(
        (event) => event.type === 'command.ack' && event.payload.commandId === command.commandId,
        sequence,
      );
      await client.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision > command.roomRevision,
        sequence,
      );
      return ack;
    }
  });

  expect(result.created).toBe(201);
  expect(result.joined).toBe(201);
  expect(result.initialRole).toBe('host');
  expect(result.wrongTokenRejected).toBe(true);
  expect(result.escalationCode).toBe('unauthorized');
  expect(result.oversizedCode).toBe('invalid_command');
  expect(result.malformedCode).toBe('invalid_command');
  expect(result.rateLimitCode).toBe('rate_limited');
  expect(result.duplicate).toBe(true);
  expect(result.draftingPhase).toBe('drafting');
  expect(result.protocolVersion).toBe(1);
  expect(result.infoProtocolVersion).toBe(1);
  expect(result.roleScopedOffers).toBe(true);
  expect(result.displayOnlySeesChampionIdentity).toBe(true);
  expect(result.privateTokenAbsent).toBe(true);
  expect(result.migratedHostId).toBe(result.playerId);
  expect(result.restoredParticipantId).toBe(result.hostId);
  expect(result.info).toMatchObject({ phase: 'drafting', playerCount: 2 });
});

test('room API rejects cross-origin, malformed and oversized HTTP requests', async ({
  request,
}) => {
  const crossOrigin = await request.post('http://127.0.0.1:4175/api/rooms', {
    headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' },
    data: { protocolVersion: 1, nickname: 'A Host' },
  });
  expect(crossOrigin.status()).toBe(403);

  const malformed = await request.post('http://127.0.0.1:4175/api/rooms', {
    headers: { 'Content-Type': 'application/json' },
    data: '{"nickname":',
  });
  expect(malformed.status()).toBe(400);

  const oversized = await request.post('http://127.0.0.1:4175/api/rooms', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ protocolVersion: 1, nickname: 'A'.repeat(5000) }),
  });
  expect(oversized.status()).toBe(400);
});
