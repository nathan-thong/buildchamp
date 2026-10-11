import { expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4175';

test('players join the shared room, lock privately, and advance together', async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  const contexts = [
    await browser.newContext({ baseURL: BASE_URL }),
    await browser.newContext({ baseURL: BASE_URL }),
    await browser.newContext({ baseURL: BASE_URL }),
    await browser.newContext({ baseURL: BASE_URL }),
  ];
  const playerPage = await contexts[0]?.newPage();
  const thirdPage = await contexts[1]?.newPage();
  const displayPage = await contexts[2]?.newPage();
  if (!playerPage || !thirdPage || !displayPage) throw new Error('Could not open room clients.');

  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/lobby');
    await page.locator('#host-nickname').fill('Host One');
    await page.getByRole('button', { name: 'Create private room' }).click();
    await expect(page.getByRole('heading', { name: 'Room waiting' })).toBeVisible();
    await expect(page.locator('.lobby-room-header__meta')).toContainText('Connected');
    const roomCode = (await page.locator('.room-code-block strong').innerText()).trim();

    await playerPage.goto(`/room/${roomCode}`);
    await playerPage.locator('#player-nickname').fill('Player Two');
    await playerPage.getByRole('button', { name: 'Join room' }).click();
    await expect(playerPage.getByRole('heading', { name: 'Room waiting' })).toBeVisible();
    await expect(playerPage.locator('.lobby-room-header__meta')).toContainText('Connected');

    await thirdPage.goto(`/room/${roomCode}`);
    await thirdPage.locator('#player-nickname').fill('Player Three');
    await thirdPage.getByRole('button', { name: 'Join room' }).click();
    await expect(thirdPage.getByRole('heading', { name: 'Room waiting' })).toBeVisible();
    await expect(thirdPage.locator('.lobby-room-header__meta')).toContainText('Connected');

    await displayPage.goto(`/display/${roomCode}`);
    await expect(displayPage.getByRole('heading', { name: 'Join the draft.' })).toBeVisible();
    await expect(
      displayPage.getByRole('img', { name: `QR code for joining room ${roomCode}` }),
    ).toBeVisible();
    const displayJoinHref = await displayPage.locator('.display-code-block a').getAttribute('href');
    expect(displayJoinHref).toBeTruthy();
    expect(new URL(displayJoinHref as string).pathname).toBe(`/room/${roomCode}`);
    expect(displayJoinHref).not.toContain('token');
    await expect(displayPage.locator('.display-page button')).toHaveCount(0);

    const start = page.getByRole('button', { name: /Start draft/ });
    const participantList = page.getByRole('list', { name: 'Room participants' });
    await expect(participantList.getByText('Player Two')).toBeVisible();
    await expect(participantList.getByText('Player Three')).toBeVisible();
    await page.getByRole('button', { name: /I’m ready/ }).click();
    await expect(start).toBeDisabled();
    await expect(start).toHaveText('Start draft · 1 ready');
    await playerPage.getByRole('button', { name: /I’m ready/ }).click();
    await expect(start).toHaveText('Start draft · 2 ready');
    await expect(start).toBeEnabled();
    await start.click();

    await expect(page.getByRole('heading', { name: 'Round 1 of 6' })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Round 1 of 6' })).toBeVisible();
    await expect(thirdPage.getByRole('heading', { name: 'Round 1 of 6' })).toBeVisible();
    await expect(displayPage.getByRole('heading', { name: 'Round 1 of 6' })).toBeVisible();
    await expect(page.getByText('0/3 locked')).toBeVisible();
    const roundOneChampion = await page.locator('.draft-offer__identity h3').innerText();

    await lockFirstAvailable(page, true);
    await expect(page.getByText(/Your choice is locked/i)).toBeVisible();
    await expect(page.getByText('1/3 locked')).toBeVisible();
    expect(await playerPage.locator('.multiplayer-choice:not(:disabled)').count()).toBeGreaterThan(
      0,
    );
    await expect(displayPage.getByText('1 / 3 locked')).toBeVisible();
    await expect(displayPage.locator('.multiplayer-choice')).toHaveCount(0);

    await lockFirstAvailable(playerPage);
    await expect(page.getByRole('heading', { name: 'Round 1 of 6' })).toBeVisible();
    await expect(displayPage.getByText('2 / 3 locked')).toBeVisible();

    const latePage = await contexts[3]?.newPage();
    if (!latePage) throw new Error('Could not open late spectator.');
    await latePage.goto(`/room/${roomCode}`);
    await latePage.locator('#player-nickname').fill('Late Arrival');
    await latePage.getByRole('button', { name: 'Join room' }).click();
    await expect(latePage.getByText(/Spectator · Connected/)).toBeVisible();
    await expect(latePage.getByText(/watching this round/i)).toBeVisible();
    await expect(latePage.locator('.multiplayer-choice')).toHaveCount(0);
    await expect(page.getByText('2/3 locked')).toBeVisible();

    await lockFirstAvailable(thirdPage);
    await expect(page.getByRole('heading', { name: 'Round 2 of 6' })).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Round 2 of 6' })).toBeVisible();
    await expect(displayPage.getByRole('heading', { name: 'Round 2 of 6' })).toBeVisible();
    const hostChampion = await page.locator('.draft-offer__identity h3').innerText();
    const playerChampion = await playerPage.locator('.draft-offer__identity h3').innerText();
    const displayChampion = await displayPage.locator('.display-champion h3').innerText();
    expect(playerChampion).toBe(hostChampion);
    expect(displayChampion).toBe(hostChampion);
    await expect(displayPage.getByText('0 / 3 locked')).toBeVisible();

    const offeredChampions = [roundOneChampion];
    for (let round = 2; round <= 6; round += 1) {
      await expect(page.getByRole('heading', { name: `Round ${round} of 6` })).toBeVisible();
      await expect(playerPage.getByRole('heading', { name: `Round ${round} of 6` })).toBeVisible();
      await expect(thirdPage.getByRole('heading', { name: `Round ${round} of 6` })).toBeVisible();
      const champion = await page.locator('.draft-offer__identity h3').innerText();
      offeredChampions.push(champion);
      for (const clientPage of [page, playerPage, thirdPage]) {
        const openChoices = clientPage.locator('.multiplayer-choice:not(:disabled)');
        const choiceCount = await openChoices.count();
        expect(choiceCount).toBeGreaterThanOrEqual(round === 6 ? 1 : 2);
        if (round === 6) expect(choiceCount).toBe(1);
      }

      await lockFirstAvailable(page);
      await lockFirstAvailable(playerPage);
      await lockFirstAvailable(thirdPage);
      if (round < 6) {
        const nextRound = round + 1;
        await expect(page.getByRole('heading', { name: `Round ${nextRound} of 6` })).toBeVisible();
        await expect(
          displayPage.getByRole('heading', { name: `Round ${nextRound} of 6` }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole('heading', { name: 'All six choices are locked.' }),
        ).toBeVisible();
        await expect(
          playerPage.getByRole('heading', { name: 'All six choices are locked.' }),
        ).toBeVisible();
        await expect(
          displayPage.getByRole('heading', { name: 'All six rounds are complete.' }),
        ).toBeVisible();
        await expect(
          displayPage.getByText('Builds remain private until the reveal step.'),
        ).toBeVisible();
        await expect(displayPage.locator('.display-champion')).toHaveCount(0);
        await expect(page.locator('.multiplayer-choice')).toHaveCount(0);
      }
    }
    expect(offeredChampions).toHaveLength(6);
    expect(new Set(offeredChampions).size).toBe(6);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('Random Champs reconnects before its shared deadline and alarm-autopicks once', async ({
  page,
}) => {
  test.setTimeout(50_000);
  await page.goto('/');
  const result = await page.evaluate(async () => {
    type Projection = {
      revision: number;
      phase: string;
      role: string;
      roomCode: string;
      currentRound?: number;
      deadlineAt: number | null;
      lockedCount: number;
      playerCount: number;
      offer?:
        | {
            id: string;
            champion: { id: string };
            variant: { id: string };
            selectableSlots: string[];
            components: Record<string, { id: string }>;
          }
        | { champion: { id: string } };
      offersByPlayer?: Array<{
        participantId: string;
        nickname: string;
        offer: { champion: { id: string } };
      }>;
      participants: Array<{
        id: string;
        role: string;
        nickname: string;
        isConnected: boolean;
        lockedThisRound: boolean;
      }>;
    };
    type Envelope = {
      type: string;
      revision: number;
      payload: Record<string, unknown>;
    };
    type Join = {
      participantId: string;
      reconnectToken: string;
      socketPath: string;
      roomCode: string;
    };
    type Client = {
      participantId: string;
      socket: WebSocket;
      projection: Projection | null;
      messages: Array<{ sequence: number; event: Envelope }>;
      waitFor: (predicate: (event: Envelope) => boolean, after?: number) => Promise<Envelope>;
      latestSequence: () => number;
    };

    const clients: Client[] = [];
    try {
      const createResponse = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolVersion: 2, nickname: 'Host One' }),
      });
      if (!createResponse.ok) throw new Error(`Create failed (${createResponse.status}).`);
      const hostJoin = (await createResponse.json()) as Join;
      const host = await connect(hostJoin);
      clients.push(host);
      await host.waitFor((event) => event.type === 'lobby.snapshot');

      const playerJoin = await join(hostJoin.roomCode, 'Player Two');
      const player = await connect(playerJoin);
      clients.push(player);
      await player.waitFor((event) => event.type === 'lobby.snapshot');

      const unreadyJoin = await join(hostJoin.roomCode, 'Player Three');
      const unready = await connect(unreadyJoin);
      clients.push(unready);
      await unready.waitFor((event) => event.type === 'lobby.snapshot');

      const displayJoin = await join(hostJoin.roomCode, '', 'display');
      const display = await connect(displayJoin);
      clients.push(display);
      const displayJoinSnapshot = await display.waitFor((event) => event.type === 'lobby.snapshot');
      await host.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' && event.revision >= displayJoinSnapshot.revision,
      );
      await player.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' && event.revision >= displayJoinSnapshot.revision,
      );
      await unready.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' && event.revision >= displayJoinSnapshot.revision,
      );

      const settings = await command(
        host,
        'host.settings',
        {
          mode: 'random',
          speed: 'quick',
          revealOrder: 'staged',
        },
        'settings-random-quick',
      );
      await player.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= (settings.payload.appliedRevision as number),
      );
      await unready.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= (settings.payload.appliedRevision as number),
      );
      await display.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= (settings.payload.appliedRevision as number),
      );
      const hostReady = await command(host, 'player.ready', { ready: true }, 'host-ready');
      await player.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= (hostReady.payload.appliedRevision as number),
      );
      const playerReady = await command(player, 'player.ready', { ready: true }, 'player-ready');
      await host.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          event.revision >= (playerReady.payload.appliedRevision as number),
      );
      await command(host, 'host.start', {}, 'start-quick');

      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.phase === 'drafting',
      );
      await player.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.phase === 'drafting',
      );
      await unready.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.phase === 'drafting',
      );
      const displayDraft = await display.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.phase === 'drafting',
      );
      const initialDeadline = displayDraft.payload.deadlineAt as number;
      const draftProjection = display.projection;
      const publicProjectionJson = JSON.stringify(draftProjection);
      const publicOfferEntries = draftProjection?.offersByPlayer ?? [];
      const championHistory = new Map(
        publicOfferEntries.map((entry) => [entry.participantId, [entry.offer.champion.id]]),
      );
      const privateBefore = player.projection?.offer as Projection['offer'];
      const startDelta = initialDeadline - Date.now();
      const displaySequenceBeforeIdle = display.latestSequence();
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      const noTickEvents = display.latestSequence() === displaySequenceBeforeIdle;

      const hostOffer = host.projection?.offer as Extract<Projection['offer'], { id: string }>;
      const hostSlot = hostOffer.selectableSlots[0];
      if (!hostSlot) throw new Error('Host did not receive a selectable slot.');
      const hostCommand = makeLockCommand(host, 'host-lock-first', hostSlot);
      const hostAck = await sendEnvelope(host, hostCommand);
      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.lockedCount === 1,
        host.latestSequence() - 1,
      );
      const hostLockedProjection = host.projection;

      player.socket.close(1000, 'Network interruption.');
      const disconnectedEvent = await host.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          (event.payload.participants as Projection['participants']).find(
            ({ id }) => id === playerJoin.participantId,
          )?.isConnected === false,
      );
      const remainsPending =
        disconnectedEvent.payload.lockedCount === 1 &&
        !(disconnectedEvent.payload.participants as Projection['participants']).find(
          ({ id }) => id === playerJoin.participantId,
        )?.lockedThisRound;

      const reconnectedPlayer = await connect(playerJoin);
      clients.push(reconnectedPlayer);
      const restored = await reconnectedPlayer.waitFor((event) => event.type === 'lobby.snapshot');
      const restoredProjection = restored.payload as unknown as Projection;
      const reconnectRestoredControl =
        restoredProjection.offer !== undefined &&
        restoredProjection.participants.find(({ id }) => id === playerJoin.participantId)
          ?.lockedThisRound === false;

      unready.socket.close(1000, 'Network interruption.');
      const unreadyDisconnected = await host.waitFor(
        (event) =>
          event.type === 'lobby.snapshot' &&
          (event.payload.participants as Projection['participants']).find(
            ({ id }) => id === unreadyJoin.participantId,
          )?.isConnected === false,
      );
      const thirdStillPending = unreadyDisconnected.payload.lockedCount === 1;

      const playerOffer = restoredProjection.offer as Extract<Projection['offer'], { id: string }>;
      const playerSlot = playerOffer.selectableSlots[0];
      if (!playerSlot) throw new Error('Player did not receive a selectable slot after reconnect.');
      const lateLockCommand = makeLockCommand(reconnectedPlayer, 'late-round-one-lock', playerSlot);
      const timeToDeadline = Math.max(0, initialDeadline - Date.now() + 200);
      await new Promise((resolve) => window.setTimeout(resolve, timeToDeadline));
      const lateResult = await sendEnvelope(reconnectedPlayer, lateLockCommand);
      const advanced = await display.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.currentRound === 2,
      );
      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.currentRound === 2,
      );
      await reconnectedPlayer.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.currentRound === 2,
      );

      const duplicateSequence = host.latestSequence();
      const duplicateAck = await sendEnvelope(host, hostCommand, duplicateSequence);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      const duplicateDidNotAdvance =
        duplicateAck.type === 'command.ack' &&
        duplicateAck.payload.duplicate === true &&
        host.projection?.currentRound === 2 &&
        host.projection?.lockedCount === 0;

      const secondDeadline = advanced.payload.deadlineAt as number;
      const secondRoundHasLegalOffers =
        (display.projection?.offersByPlayer ?? []).length === 3 &&
        ((host.projection?.offer as Extract<Projection['offer'], { id: string }> | undefined)
          ?.selectableSlots.length ?? 0) >= 2 &&
        ((
          reconnectedPlayer.projection?.offer as
            Extract<Projection['offer'], { id: string }> | undefined
        )?.selectableSlots.length ?? 0) >= 2;

      const reconnectedUnready = await connect(unreadyJoin);
      clients.push(reconnectedUnready);
      const reconnectedUnreadySnapshot = await reconnectedUnready.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.currentRound === 2,
      );
      const connectedRevision = reconnectedUnreadySnapshot.revision;
      await host.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision >= connectedRevision,
      );
      await reconnectedPlayer.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.revision >= connectedRevision,
      );

      const randomPlayers = [host, reconnectedPlayer, reconnectedUnready];
      const roundTwoOfferChecks = captureRandomRoundOffers(
        2,
        randomPlayers,
        display.projection,
        championHistory,
      );

      const simultaneousClients = randomPlayers;
      const hostRoundTwoOffer = host.projection?.offer as Extract<
        Projection['offer'],
        { id: string }
      >;
      const playerRoundTwoOffer = reconnectedPlayer.projection?.offer as Extract<
        Projection['offer'],
        { id: string }
      >;
      const thirdRoundTwoOffer = reconnectedUnready.projection?.offer as Extract<
        Projection['offer'],
        { id: string }
      >;
      const simultaneousCommands = [
        makeLockCommand(
          host,
          'host-round-two-concurrent',
          hostRoundTwoOffer.selectableSlots[0] ?? '',
        ),
        makeLockCommand(
          reconnectedPlayer,
          'player-round-two-concurrent',
          playerRoundTwoOffer.selectableSlots[0] ?? '',
        ),
        makeLockCommand(
          reconnectedUnready,
          'third-round-two-concurrent',
          thirdRoundTwoOffer.selectableSlots[0] ?? '',
        ),
      ];
      const simultaneousRevision = new Set(
        simultaneousCommands.map((envelope) => envelope.roomRevision),
      );
      const displayBeforeConcurrent = display.latestSequence();
      const simultaneousResults = await Promise.all(
        simultaneousCommands.map((envelope, index) =>
          sendEnvelope(simultaneousClients[index] as Client, envelope),
        ),
      );
      const roundThreeEvent = await display.waitFor(
        (event) => event.type === 'lobby.snapshot' && event.payload.currentRound === 3,
      );
      await Promise.all(
        randomPlayers.map((client) =>
          client.waitFor(
            (event) =>
              event.type === 'lobby.snapshot' && event.revision >= roundThreeEvent.revision,
          ),
        ),
      );
      const roundThreeOfferChecks = captureRandomRoundOffers(
        3,
        randomPlayers,
        display.projection,
        championHistory,
      );
      const roundThreeSnapshotCount = display.messages.filter(
        ({ sequence, event }) =>
          sequence > displayBeforeConcurrent &&
          event.type === 'lobby.snapshot' &&
          event.payload.currentRound === 3,
      ).length;
      const appliedRevisions = simultaneousResults.map(
        (event) => event.payload.appliedRevision as number,
      );
      const lastLockIndex = appliedRevisions.indexOf(Math.max(...appliedRevisions));
      const lastLockClient = simultaneousClients[lastLockIndex];
      const lastLockCommand = simultaneousCommands[lastLockIndex];
      if (!lastLockClient || !lastLockCommand)
        throw new Error('The final concurrent lock was missing.');
      const retrySequence = lastLockClient.latestSequence();
      const finalLockRetry = await sendEnvelope(lastLockClient, lastLockCommand, retrySequence);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      const retryProducedNoSecondAdvance =
        finalLockRetry.type === 'command.ack' &&
        finalLockRetry.payload.duplicate === true &&
        display.messages.filter(
          ({ sequence, event }) =>
            sequence > displayBeforeConcurrent &&
            event.type === 'lobby.snapshot' &&
            event.payload.currentRound === 3,
        ).length === 1;

      const roundAdvancementCounts: number[] = [];
      let randomOffersRemainLegal = roundTwoOfferChecks.legal && roundThreeOfferChecks.legal;
      let randomPublicIdentitiesMatch =
        roundTwoOfferChecks.identityOnly &&
        roundTwoOfferChecks.matchPlayers &&
        roundThreeOfferChecks.identityOnly &&
        roundThreeOfferChecks.matchPlayers;
      let finalProjection: Projection | null = null;
      for (let round = 3; round <= 6; round += 1) {
        if (round > 3) {
          const currentRoundEvent = await display.waitFor(
            (event) =>
              event.type === 'lobby.snapshot' &&
              event.payload.phase === 'drafting' &&
              event.payload.currentRound === round,
          );
          await Promise.all(
            randomPlayers.map((client) =>
              client.waitFor(
                (event) =>
                  event.type === 'lobby.snapshot' && event.revision >= currentRoundEvent.revision,
              ),
            ),
          );
          const offerChecks = captureRandomRoundOffers(
            round,
            randomPlayers,
            display.projection,
            championHistory,
          );
          randomOffersRemainLegal &&= offerChecks.legal;
          randomPublicIdentitiesMatch &&= offerChecks.identityOnly && offerChecks.matchPlayers;
        }

        const roundOffers = randomPlayers.map((client) =>
          client.projection?.offer && 'id' in client.projection.offer
            ? client.projection.offer
            : null,
        );
        if (roundOffers.some((offer) => offer === null))
          throw new Error(`A private Random Champs offer was missing in round ${round}.`);
        const roundLocks = randomPlayers.map((client, index) => {
          const offer = roundOffers[index];
          const slot = offer?.selectableSlots[0];
          if (!slot) throw new Error(`No legal component was available in round ${round}.`);
          return makeLockCommand(client, `full-run-${round}-${index}`, slot);
        });
        const lockRevisionSet = new Set(roundLocks.map((envelope) => envelope.roomRevision));
        if (lockRevisionSet.size !== 1)
          throw new Error(`Round ${round} players did not share the same revision.`);
        const sequenceBeforeLocks = display.latestSequence();
        const lockResults = await Promise.all(
          roundLocks.map((envelope, index) =>
            sendEnvelope(randomPlayers[index] as Client, envelope),
          ),
        );
        if (lockResults.some((event) => event.type !== 'command.ack'))
          throw new Error(`A player lock failed in round ${round}.`);
        const resolvedRound = await display.waitFor(
          (event) =>
            event.type === 'lobby.snapshot' &&
            (round === 6
              ? event.payload.phase === 'draft-complete'
              : event.payload.currentRound === round + 1),
        );
        await Promise.all(
          randomPlayers.map((client) =>
            client.waitFor(
              (event) =>
                event.type === 'lobby.snapshot' && event.revision >= resolvedRound.revision,
            ),
          ),
        );
        const advancementCount = display.messages.filter(
          ({ sequence, event }) =>
            sequence > sequenceBeforeLocks &&
            event.type === 'lobby.snapshot' &&
            (round === 6
              ? event.payload.phase === 'draft-complete'
              : event.payload.currentRound === round + 1),
        ).length;
        roundAdvancementCounts.push(advancementCount);
        if (round === 6) finalProjection = display.projection;
      }
      const fullRandomRunHasNoRepeatedChampion = [...championHistory.values()].every(
        (champions) => champions.length === 6 && new Set(champions).size === 6,
      );
      const finalProjectionJson = JSON.stringify(finalProjection);
      const finalDraftStaysPrivate =
        finalProjection?.phase === 'draft-complete' &&
        finalProjection.currentRound === 6 &&
        finalProjection.deadlineAt === null &&
        finalProjection.offer === undefined &&
        finalProjection.offersByPlayer === undefined &&
        !finalProjectionJson.includes('selectableSlots') &&
        !finalProjectionJson.includes('components') &&
        !finalProjectionJson.includes('variant') &&
        !finalProjectionJson.includes('componentId') &&
        randomPlayers.every((client) => client.projection?.offer === undefined);
      const advancedExactlyOnceThroughFullRun =
        roundAdvancementCounts.length === 4 && roundAdvancementCounts.every((count) => count === 1);

      host.socket.close();
      reconnectedPlayer.socket.close();
      display.socket.close();

      return {
        randomMode: draftProjection?.role === 'display' && publicOfferEntries.length === 3,
        publicIdentityOnly:
          publicOfferEntries.every((entry) => Object.keys(entry.offer).join(',') === 'champion') &&
          !publicProjectionJson.includes('components') &&
          !publicProjectionJson.includes('selectableSlots') &&
          !publicProjectionJson.includes('componentId') &&
          !publicProjectionJson.includes('lockedBuild') &&
          !publicProjectionJson.includes('variant'),
        playerHasPrivateOffer: Boolean(privateBefore && 'id' in privateBefore),
        tokenNotProjected:
          !publicProjectionJson.includes(hostJoin.reconnectToken) &&
          !publicProjectionJson.includes(playerJoin.reconnectToken),
        initialDeadline,
        startDelta,
        noTickEvents,
        hostLockAccepted: hostAck.type === 'command.ack',
        hostLockHidesOffer:
          hostLockedProjection?.offer === undefined && hostLockedProjection?.lockedCount === 1,
        remainsPending,
        reconnectRestoredControl,
        thirdStillPending,
        lateLockCode: lateResult.payload.code,
        advancedRound: advanced.payload.currentRound,
        deadlineIntervals: secondDeadline - initialDeadline,
        duplicate: duplicateAck.payload.duplicate,
        duplicateDidNotAdvance,
        secondRoundHasLegalOffers,
        allThreeConcurrentLocksAccepted: simultaneousResults.every(
          (event) => event.type === 'command.ack',
        ),
        concurrentLocksUsedSameRevision: simultaneousRevision.size === 1,
        roundThreeReached: roundThreeEvent.payload.currentRound,
        roundThreeSnapshotCount,
        retryProducedNoSecondAdvance,
        randomOffersRemainLegal,
        randomPublicIdentitiesMatch,
        fullRandomRunHasNoRepeatedChampion,
        advancedExactlyOnceThroughFullRun,
        finalDraftStaysPrivate,
      };

      async function join(
        roomCode: string,
        nickname: string,
        role: 'player' | 'display' = 'player',
      ): Promise<Join> {
        const response = await fetch(`/api/rooms/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            protocolVersion: 2,
            ...(role === 'display' ? {} : { nickname }),
            role,
          }),
        });
        if (!response.ok) throw new Error(`Join failed (${response.status}).`);
        return (await response.json()) as Join;
      }

      async function connect(joinInfo: Join): Promise<Client> {
        const socketUrl = new URL(joinInfo.socketPath, location.href);
        socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(socketUrl, [
          'buildchamp.v2',
          `participant.${joinInfo.participantId}`,
          `token.${joinInfo.reconnectToken}`,
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
          participantId: joinInfo.participantId,
          socket,
          projection: null,
          messages,
          latestSequence: () => sequence,
          waitFor: (predicate, after = 0) => {
            const existing = messages.find(
              (item) => item.sequence > after && predicate(item.event),
            );
            if (existing) return Promise.resolve(existing.event);
            return new Promise((resolve, reject) => {
              const waiter = {
                predicate,
                after,
                resolve,
                timer: window.setTimeout(
                  () => reject(new Error('Timed out waiting for room state.')),
                  25_000,
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
          if (event.type === 'lobby.snapshot')
            client.projection = event.payload as unknown as Projection;
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
          socket.addEventListener('error', () => reject(new Error('Room socket was rejected.')), {
            once: true,
          });
        });
        if (socket.protocol !== 'buildchamp.v2') throw new Error('Unexpected protocol version.');
        return client;
      }

      async function command(
        client: Client,
        type: string,
        payload: Record<string, unknown>,
        commandId: string,
      ) {
        const revision = client.projection?.revision;
        if (revision === undefined) throw new Error('Client has no current room revision.');
        const result = await sendEnvelope(client, {
          protocolVersion: 2,
          commandId,
          roomRevision: revision,
          type,
          payload,
        });
        if (result.type !== 'command.ack') {
          throw new Error(`Command ${type} was rejected: ${String(result.payload.code)}.`);
        }
        const appliedRevision = result.payload.appliedRevision as number;
        await client.waitFor(
          (event) => event.type === 'lobby.snapshot' && event.revision >= appliedRevision,
        );
        return result;
      }

      function makeLockCommand(client: Client, commandId: string, slot: string) {
        const offer = client.projection?.offer as
          Extract<Projection['offer'], { id: string }> | undefined;
        const component = offer?.components[slot];
        if (!offer || !component || !client.projection?.currentRound)
          throw new Error('Private offer was missing.');
        return {
          protocolVersion: 2,
          commandId,
          roomRevision: client.projection.revision,
          type: 'player.lock',
          payload: {
            round: client.projection.currentRound,
            selection: {
              offerId: offer.id,
              championId: offer.champion.id,
              variantId: offer.variant.id,
              slot,
              componentId: component.id,
            },
          },
        };
      }

      async function sendEnvelope(
        client: Client,
        envelope: Record<string, unknown>,
        after = client.latestSequence(),
      ) {
        client.socket.send(JSON.stringify(envelope));
        return client.waitFor(
          (event) =>
            (event.type === 'command.ack' || event.type === 'lobby.error') &&
            event.payload.commandId === envelope.commandId,
          after,
        );
      }

      function captureRandomRoundOffers(
        round: number,
        players: Client[],
        publicProjection: Projection | null,
        history: Map<string, string[]>,
      ) {
        const entries = publicProjection?.offersByPlayer ?? [];
        const identityOnly =
          entries.length === players.length &&
          entries.every((entry) => Object.keys(entry.offer).join(',') === 'champion');
        let matchPlayers = entries.length === players.length;
        let legal = entries.length === players.length;
        for (const client of players) {
          const participantId = client.participantId;
          const privateOffer = client.projection?.offer;
          const publicEntry = entries.find((entry) => entry.participantId === participantId);
          if (!participantId || !privateOffer || !('id' in privateOffer) || !publicEntry) {
            matchPlayers = false;
            legal = false;
            continue;
          }
          matchPlayers &&= privateOffer.champion.id === publicEntry.offer.champion.id;
          legal &&=
            privateOffer.selectableSlots.length >= (round === 6 ? 1 : 2) &&
            (round !== 6 || privateOffer.selectableSlots.length === 1);
          history.get(participantId)?.push(privateOffer.champion.id);
        }
        return { identityOnly, matchPlayers, legal };
      }
    } finally {
      clients.forEach(({ socket }) => socket.close());
    }
  });

  expect(result.randomMode).toBe(true);
  expect(result.publicIdentityOnly).toBe(true);
  expect(result.playerHasPrivateOffer).toBe(true);
  expect(result.tokenNotProjected).toBe(true);
  expect(result.startDelta).toBeGreaterThan(13_000);
  expect(result.startDelta).toBeLessThanOrEqual(15_000);
  expect(result.noTickEvents).toBe(true);
  expect(result.hostLockAccepted).toBe(true);
  expect(result.hostLockHidesOffer).toBe(true);
  expect(result.remainsPending).toBe(true);
  expect(result.reconnectRestoredControl).toBe(true);
  expect(result.thirdStillPending).toBe(true);
  expect(result.lateLockCode).toBe('wrong_phase');
  expect(result.advancedRound).toBe(2);
  expect(result.deadlineIntervals).toBeGreaterThanOrEqual(15_000);
  expect(result.deadlineIntervals).toBeLessThan(17_000);
  expect(result.duplicate).toBe(true);
  expect(result.duplicateDidNotAdvance).toBe(true);
  expect(result.secondRoundHasLegalOffers).toBe(true);
  expect(result.allThreeConcurrentLocksAccepted).toBe(true);
  expect(result.concurrentLocksUsedSameRevision).toBe(true);
  expect(result.roundThreeReached).toBe(3);
  expect(result.roundThreeSnapshotCount).toBe(1);
  expect(result.retryProducedNoSecondAdvance).toBe(true);
  expect(result.randomOffersRemainLegal).toBe(true);
  expect(result.randomPublicIdentitiesMatch).toBe(true);
  expect(result.fullRandomRunHasNoRepeatedChampion).toBe(true);
  expect(result.advancedExactlyOnceThroughFullRun).toBe(true);
  expect(result.finalDraftStaysPrivate).toBe(true);
});

async function lockFirstAvailable(page: Page, reducedMotion = false): Promise<void> {
  const firstChoice = page.locator('.multiplayer-choice:not(:disabled)').first();
  await expect(firstChoice).toBeVisible();
  const slot = (
    await firstChoice.locator('.multiplayer-choice__topline span').first().innerText()
  ).trim();
  await firstChoice.focus();
  await firstChoice.press('Enter');
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'true');
  expect(await firstChoice.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  if (reducedMotion) {
    expect(
      await firstChoice.evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toContain('1e-05s');
    await firstChoice.hover();
    expect(await firstChoice.evaluate((element) => getComputedStyle(element).transform)).toBe(
      'none',
    );
  }
  const lockButton = page.getByRole('button', { name: `Lock ${slot} permanently` });
  await lockButton.focus();
  await lockButton.press('Enter');
}
