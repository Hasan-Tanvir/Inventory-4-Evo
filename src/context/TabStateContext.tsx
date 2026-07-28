import React, { createContext, useContext, useEffect, useState } from 'react';

interface TabState {
  [tabPath: string]: Record<string, any>;
}

interface TabStateContextType {
  tabState: TabState;
  saveTabState: (tabPath: string, state: Record<string, any>) => void;
  getTabState: (tabPath: string) => Record<string, any>;
  clearTabState: (tabPath?: string) => void;
}

const TabStateContext = createContext<TabStateContextType | undefined>(undefined);

export const TabStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabState, setTabState] = useState<TabState>({});

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tabState');
      if (saved) {
        setTabState(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load tab state:', err);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tabState', JSON.stringify(tabState));
  }, [tabState]);

  const saveTabState = React.useCallback((tabPath: string, state: Record<string, any>) => {
    setTabState(prev => {
      const existing = prev[tabPath] || {};
      const next = { ...existing, ...state };
      const hasChanged = Object.keys(next).some(key => next[key] !== existing[key]) || Object.keys(existing).length !== Object.keys(next).length;
      return hasChanged ? { ...prev, [tabPath]: next } : prev;
    });
  }, []);

  const getTabState = React.useCallback((tabPath: string): Record<string, any> => {
    return tabState[tabPath] || {};
  }, [tabState]);

  const clearTabState = React.useCallback((tabPath?: string) => {
    if (tabPath) {
      setTabState(prev => {
        const newState = { ...prev };
        delete newState[tabPath];
        return newState;
      });
    } else {
      setTabState({});
    }
  }, []);

  const value = React.useMemo(
    () => ({ tabState, saveTabState, getTabState, clearTabState }),
    [tabState, saveTabState, getTabState, clearTabState]
  );

  return (
    <TabStateContext.Provider value={value}>
      {children}
    </TabStateContext.Provider>
  );
};

export const useTabState = () => {
  const context = useContext(TabStateContext);
  if (!context) {
    throw new Error('useTabState must be used within TabStateProvider');
  }
  return context;
};
