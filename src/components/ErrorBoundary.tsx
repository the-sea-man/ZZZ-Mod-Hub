import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-textMain p-8">
          <div className="bg-surface/50 border border-red-500/20 p-8 rounded-3xl max-w-2xl w-full shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-4 text-red-400 mb-6">
              <AlertTriangle size={48} />
              <h1 className="text-3xl font-black tracking-tight">Application Crashed</h1>
            </div>
            
            <p className="text-textMuted mb-6 text-sm">
              The application encountered a critical runtime error. This was likely caused by a recent code change or an unexpected state.
            </p>

            <div className="bg-black/40 p-4 rounded-xl font-mono text-sm overflow-auto mb-6 border border-white/5 max-h-64 custom-scrollbar">
              <div className="text-red-400 font-bold mb-2">{this.state.error?.toString()}</div>
              <div className="text-textMuted/60 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</div>
            </div>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold transition-all w-full justify-center"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
