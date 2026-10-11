import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { LobbyProjection } from '../../worker/lobby/schemas';
import { leaveLobby, readLobbySessions, saveLobbySession, type LobbySession } from './lobby-client';
import { useLobbyConnection, type LobbyConnectionStatus } from './use-lobby-connection';

type LobbySessionContextValue = Readonly<{
  session: LobbySession | null;
  projection: LobbyProjection | null;
  status: LobbyConnectionStatus;
  error: string | null;
  sendCommand: ReturnType<typeof useLobbyConnection>['sendCommand'];
  activateSession: (session: LobbySession) => void;
  leaveActiveSession: () => Promise<void>;
}>;

const LobbySessionContext = createContext<LobbySessionContextValue | null>(null);

function initialParticipantSession(): LobbySession | null {
  return readLobbySessions().find((candidate) => candidate.role !== 'display') ?? null;
}

export function LobbySessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<LobbySession | null>(initialParticipantSession);
  const connection = useLobbyConnection(session);
  const activateSession = useCallback((next: LobbySession) => {
    if (next.role === 'display') return;
    saveLobbySession(next);
    setSession(next);
  }, []);
  const leaveActiveSession = useCallback(async () => {
    if (!session) return;
    await leaveLobby(session);
    setSession((current) => (current?.participantId === session.participantId ? null : current));
  }, [session]);
  const value = useMemo(
    () => ({ session, ...connection, activateSession, leaveActiveSession }),
    [session, connection, activateSession, leaveActiveSession],
  );

  return <LobbySessionContext.Provider value={value}>{children}</LobbySessionContext.Provider>;
}

export function useLobbySession(): LobbySessionContextValue {
  const value = useOptionalLobbySession();
  if (!value) throw new Error('useLobbySession must be used inside LobbySessionProvider.');
  return value;
}

export function useOptionalLobbySession(): LobbySessionContextValue | null {
  return useContext(LobbySessionContext);
}
