import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { translations } from './translations';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Last-resort fallback so a render error shows a message instead of a blank page.
// It lives outside <App/>, so theme and language are read from the same
// localStorage keys App uses.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let lang: 'en' | 'es' = 'en';
    let isDarkMode = true;
    try {
      lang = localStorage.getItem('viral_ranker_lang') === 'es' ? 'es' : 'en';
      isDarkMode = localStorage.getItem('viral_ranker_dark_mode') !== 'false';
    } catch (e) {
      // Storage unavailable: keep defaults
    }
    const t = translations[lang];

    return (
      <div className={`flex h-screen items-center justify-center p-10 ${isDarkMode ? 'bg-[#0a0a0a] text-gray-200' : 'bg-[#f8f9fa] text-gray-900'}`}>
        <div className={`max-w-md w-full text-center space-y-6 p-10 rounded-[32px] border ${isDarkMode ? 'bg-[#111] border-white/5' : 'bg-white border-gray-200 shadow-xl'}`}>
          <AlertCircle size={48} className="text-red-500 mx-auto" />
          <h1 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.errorBoundaryTitle}</h1>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.errorBoundaryDesc}</p>
          <button
            onClick={this.handleReload}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black inline-flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            <RotateCcw size={18} /> {t.errorBoundaryReload}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
