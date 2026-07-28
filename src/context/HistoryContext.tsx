import React, { createContext, useContext, useState } from 'react';
import { getCurrentTimestamp } from '@/utils/date';

export interface HistoryItem {
  id: string;
  type: 'order' | 'payment' | 'commission' | 'stock' | 'customer' | 'system';
  title: string;
  description: string;
  timestamp: string;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: (type?: HistoryItem['type']) => void;
  getHistoryByType: (type: HistoryItem['type']) => HistoryItem[];
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const addHistoryItem = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: `HIS-${Date.now()}`,
      timestamp: getCurrentTimestamp()
    };
    setHistory(prev => [newItem, ...prev]); // Add to top (recent first)
  };

  const clearHistory = (type?: HistoryItem['type']) => {
    if (type) {
      setHistory(prev => prev.filter(item => item.type !== type));
    } else {
      setHistory([]);
    }
  };

  const getHistoryByType = (type: HistoryItem['type']): HistoryItem[] => {
    return history.filter(item => item.type === type);
  };

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, clearHistory, getHistoryByType }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within HistoryProvider');
  }
  return context;
};
