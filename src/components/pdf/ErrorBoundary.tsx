'use client';

/**
 * PDFErrorBoundary Component
 *
 * Wraps PDFViewer to catch rendering errors and show a friendly
 * "Something went wrong" message with a retry button.
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export class PDFErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('PDFErrorBoundary caught error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center max-w-sm px-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-1">
              The PDF viewer encountered an unexpected error.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/70 mb-4 font-mono">
                {this.state.error}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
