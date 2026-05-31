import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.logErrorToBackend(error, errorInfo);
  }

  private async logErrorToBackend(error: Error, errorInfo: ErrorInfo) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !apiKey) return;

      const payload = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        userId: null,
      };

      await fetch(`${supabaseUrl}/functions/v1/log-client-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Best effort — silently fail
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Path: ${window.location.pathname}
Time: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
    `.trim();

    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg border p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-foreground">
                  Ocorreu um erro ao carregar esta tela
                </h1>
                <p className="text-sm text-muted-foreground">
                  Tente recarregar a página ou fazer login novamente.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleReload} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Recarregar Página
              </Button>
              
              <Button variant="outline" onClick={this.handleLogout} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Voltar para Login
              </Button>
            </div>

            <div className="border-t pt-4">
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Detalhes técnicos</span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showDetails && (
                <div className="mt-3 space-y-3">
                  <div className="bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-48">
                    <p className="text-destructive font-semibold">{error?.message}</p>
                    {error?.stack && (
                      <pre className="mt-2 text-muted-foreground whitespace-pre-wrap">
                        {error.stack.split('\n').slice(0, 5).join('\n')}
                      </pre>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={this.handleCopyError}
                    className="w-full"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar detalhes do erro
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
