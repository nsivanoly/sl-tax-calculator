import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TaxFiling } from '../types';

/**
 * Filing context — tracks the currently selected filing (user + FY pair).
 * Used by workspace pages to know which filing they're working on.
 */

interface FilingContextType {
  currentFiling: TaxFiling | null;
  setCurrentFiling: (filing: TaxFiling | null) => void;
}

const FilingContext = createContext<FilingContextType | undefined>(undefined);

export const FilingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentFiling, setCurrentFilingState] = useState<TaxFiling | null>(null);

  const setCurrentFiling = useCallback((filing: TaxFiling | null) => {
    setCurrentFilingState(filing);
    if (filing) {
      localStorage.setItem('current_filing_id', filing.id);
    } else {
      localStorage.removeItem('current_filing_id');
    }
  }, []);

  return (
    <FilingContext.Provider value={{ currentFiling, setCurrentFiling }}>
      {children}
    </FilingContext.Provider>
  );
};

export function useFilingContext() {
  const context = useContext(FilingContext);
  if (context === undefined) {
    throw new Error('useFilingContext must be used within a FilingProvider');
  }
  return context;
}
