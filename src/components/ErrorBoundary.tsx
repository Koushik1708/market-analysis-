import React, { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-red-100 max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        
        <h2 className="text-xl font-bold text-zinc-900">Prediction Rendering Error</h2>
        <p className="text-zinc-500 text-sm pb-4 border-b border-zinc-100">
          Some prediction data may be missing. Please regenerate the forecast.
        </p>
        
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-left text-xs text-red-600 bg-red-50 p-4 rounded-xl overflow-auto mt-4 max-h-32">
            {(error as Error).message || String(error)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default function ErrorBoundary({ children }: Props) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
