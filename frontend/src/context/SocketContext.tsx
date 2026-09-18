import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  burnRate: number;
  remainingBalance: number | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  burnRate: 0,
  remainingBalance: null
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [burnRate, setBurnRate] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const s = io(socketUrl, {
      query: { userId: user.id },
      transports: ['websocket']
    });

    s.on('wallet:balance_update', (data: { balance: number; currentBurnRate: number }) => {
      setRemainingBalance(data.balance);
      setBurnRate(data.currentBurnRate);
    });

    s.on('wallet:low_warning', (data: { message: string }) => {
      alert(`[Balance Alert]: ${data.message}`);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, burnRate, remainingBalance }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);