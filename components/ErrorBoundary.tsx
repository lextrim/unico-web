import React from 'react';

interface State { hasError: boolean; }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center gap-6">
          <p className="text-2xl font-black uppercase tracking-widest">Algo salió mal</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
