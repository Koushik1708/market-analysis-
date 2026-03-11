import { useState } from 'react';
import LandingPage from './components/LandingPage';
import StockDashboard from './components/StockDashboard';
import AIPredictionPage from './components/AIPredictionPage';
import ErrorBoundary from './components/ErrorBoundary';
import { StockDataPoint, AppDocument } from './types';

export default function App() {
  const [appState, setAppState] = useState<{
    view: 'landing' | 'dashboard' | 'prediction';
    customData?: StockDataPoint[];
    predictionResult?: any; // Storing the api payload
    fileName?: string;
    years?: number;
    documents: AppDocument[];
  }>({ view: 'landing', documents: [] });

  const handleDataLoaded = (data: StockDataPoint[], fileName: string, documents: AppDocument[], years?: number) => {
    setAppState({
      view: 'dashboard',
      customData: data,
      fileName: fileName,
      documents: documents,
      years: years
    });
  };

  const handleReset = () => {
    setAppState({ view: 'landing', documents: [] });
  };

  const handlePredict = (fetchedData?: StockDataPoint[], predictionResult?: any) => {
    setAppState(prev => ({
      ...prev,
      view: 'prediction',
      // If the dashboard fetched new data, keep it!
      customData: fetchedData || prev.customData,
      predictionResult: predictionResult || prev.predictionResult
    }));
  };

  const handleBackToDashboard = () => {
    setAppState(prev => ({ ...prev, view: 'dashboard' }));
  };

  return (
    <div className="min-h-screen bg-zinc-50 overflow-x-hidden">
      {appState.view === 'landing' ? (
        <LandingPage onDataLoaded={handleDataLoaded} />
      ) : appState.view === 'prediction' ? (
        <ErrorBoundary>
          <AIPredictionPage
            data={appState.customData as any}
            predictionResult={appState.predictionResult}
            symbolName={appState.fileName}
            onBack={handleBackToDashboard}
          />
        </ErrorBoundary>
      ) : (
        <StockDashboard
          customData={appState.customData}
          symbolName={appState.fileName}
          years={appState.years}
          documents={appState.documents}
          onReset={handleReset}
          onPredict={handlePredict}
        />
      )}
    </div>
  );
}
