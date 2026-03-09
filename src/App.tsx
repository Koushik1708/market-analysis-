/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import LandingPage from './components/LandingPage';
import StockDashboard from './components/StockDashboard';
import { StockDataPoint, AppDocument } from './types';

export default function App() {
  const [appState, setAppState] = useState<{
    view: 'landing' | 'dashboard';
    customData?: StockDataPoint[];
    fileName?: string;
    documents: AppDocument[];
  }>({ view: 'landing', documents: [] });

  const handleDataLoaded = (data: StockDataPoint[], fileName: string, documents: AppDocument[]) => {
    setAppState({
      view: 'dashboard',
      customData: data,
      fileName: fileName.split('.')[0], // Remove extension for display
      documents: documents
    });
  };

  const handleReset = () => {
    setAppState({ view: 'landing', documents: [] });
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {appState.view === 'landing' ? (
        <LandingPage onDataLoaded={handleDataLoaded} />
      ) : (
        <StockDashboard 
          customData={appState.customData} 
          symbolName={appState.fileName}
          documents={appState.documents}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
