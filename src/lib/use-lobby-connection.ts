import { useCallback, useEffect, useRef, useState } from 'react';

import type { LobbyProjection } from '../../worker/lobby/schemas';
import {
  claimLobbySession,
  connectLobbySocket,
  makeClientCommand,
  LobbySessionError,
  type LobbyCommandRequest,
  type LobbySession,
} from './lobby-client';

export type LobbyConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'blocked';

export function useLobbyConnection(session: LobbySession | null) {
  const [projection, setProjection] = useState<LobbyProjection | null>(null);
  const [status, setStatus] = useState<LobbyConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const projectionRef = useRef<LobbyProjection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!session) {
      setProjection(null);
      projectionRef.current = null;
      setStatus('connecting');
      setError(null);
      socketRef.current = null;
      return;
    }
    const activeSession = session;
    let active = true;
    let reconnectTimer: number | null = null;
    let attempts = 0;

    async function connect() {
      if (!active) return;
      setStatus(attempts === 0 ? 'connecting' : 'reconnecting');
      try {
        await claimLobbySession(activeSession);
        if (!active) return;
        const socket = connectLobbySocket(activeSession, {
          onOpen: () => {
            if (!active) return;
            attempts = 0;
            setStatus('connected');
            setError(null);
          },
          onClose: (event) => {
            if (!active) return;
            if (event.code === 4001) {
              setStatus('blocked');
              setError('This room is open in another tab. The newer tab now controls this seat.');
              return;
            }
            if (event.code === 4003 || event.code === 1008) {
              setStatus('blocked');
              setError(
                'This seat has left the room or was removed. Return to Rooms to join again.',
              );
              return;
            }
            setStatus('reconnecting');
            const delay = Math.min(30_000, 500 * 2 ** Math.min(attempts, 6));
            attempts += 1;
            reconnectTimer = window.setTimeout(() => void connect(), delay);
          },
          onProjection: (next) => {
            if (!active) return;
            const previous = projectionRef.current;
            if (previous && next.revision < previous.revision) return;
            projectionRef.current = next;
            setProjection(next);
            setError(null);
          },
          onError: (message) => {
            if (active) setError(message);
          },
        });
        socketRef.current = socket;
      } catch (cause) {
        if (cause instanceof LobbySessionError && cause.terminal) {
          setStatus('blocked');
          setError(cause.message);
          return;
        }
        setStatus('reconnecting');
        setError(cause instanceof Error ? cause.message : 'The room could not be reached.');
        attempts += 1;
        reconnectTimer = window.setTimeout(
          () => void connect(),
          Math.min(30_000, 500 * 2 ** Math.min(attempts, 6)),
        );
      }
    }

    void connect();
    return () => {
      active = false;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Room view closed.');
    };
  }, [session]);

  const sendCommand = useCallback((request: LobbyCommandRequest): boolean => {
    const socket = socketRef.current;
    const currentProjection = projectionRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !currentProjection) {
      setError('Reconnect before sending that room action.');
      return false;
    }
    try {
      const command = makeClientCommand(
        currentProjection.revision,
        request,
        currentProjection.deadlineAt,
      );
      socket.send(JSON.stringify(command));
      setError(null);
      return true;
    } catch {
      setError('That room action could not be sent. Try again.');
      return false;
    }
  }, []);

  return { projection, status, error, sendCommand };
}
