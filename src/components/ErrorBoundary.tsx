import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 transition-colors duration-500">
          <div className="max-w-md w-full bg-bg-secondary rounded-3xl shadow-2xl p-8 text-center border border-card-border transition-colors">
            <div className="bg-accent-emergency/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-accent-emergency/10">
              <AlertCircle className="text-accent-emergency w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-text-primary mb-2 transition-colors uppercase tracking-tight">System Core Error</h1>
            <p className="text-text-secondary mb-8 text-sm leading-relaxed transition-colors font-medium">
              TRISHAK encountered an unexpected protocol conflict. The AI Incident Commander has been notified.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-accent-emergency text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-accent-emergency/20 uppercase tracking-widest text-xs"
              >
                <RefreshCw className="w-5 h-5" /> REBOOT CORE
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-bg-primary text-text-secondary font-black py-4 rounded-2xl flex items-center justify-center gap-2 border border-card-border hover:bg-text-primary hover:text-bg-primary transition-all uppercase tracking-widest text-xs"
              >
                <Home className="w-5 h-5" /> INITIALIZE RESET
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-6 bg-black rounded-2xl text-left overflow-auto max-h-40 border border-red-500/20">
                <p className="text-[10px] font-mono text-red-500 tracking-tight leading-relaxed">{this.state.error?.toString()}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
