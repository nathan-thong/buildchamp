import { useCallback, useEffect, useRef, useState } from 'react';

import type { LobbyProjection } from '../../worker/lobby/schemas';
import {
  connectLobbySocket,
  makeClientCommand,
  type LobbyCommandRequest,
  type LobbySession,
} from './lobby-client';

export type LobbyConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export function useLobbyConnection(session: LobbySession) {
  const [projection, setProjection] = useState<LobbyProjection | null>(null);
  const [status, setStatus] = useState<LobbyConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const projectionRef = useRef<LobbyProjection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let reconnectTimer: number | null = null;
    let attempts = 0;

    function connect() {
      if (!active) return;
      setStatus(attempts === 0 ? 'connecting' : 'reconnecting');
      try {
        const socket = connectLobbySocket(session, {
          onOpen: () => {
            if (!active) return;
            attempts = 0;
            setStatus('connected');
            setError(null);
          },
          onClose: () => {
            if (!active) return;
            setStatus('reconnecting');
            const delay = Math.min(30_000, 500 * 2 ** Math.min(attempts, 6));
            attempts += 1;
            reconnectTimer = window.setTimeout(connect, delay);
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
      } catch {
        setStatus('reconnecting');
        attempts += 1;
        reconnectTimer = window.setTimeout(
          connect,
          Math.min(30_000, 500 * 2 ** Math.min(attempts, 6)),
        );
      }
    }

    connect();
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
      const command = makeClientCommand(currentProjection.revision, request);
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
