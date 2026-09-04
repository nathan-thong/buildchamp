import { Component, type ErrorInfo, type ReactNode } from 'react';

import { FatalErrorState } from './StatePanels';

type ErrorBoundaryProps = {
  readonly children: ReactNode;
};

type ErrorBoundaryState = {
  readonly error: Error | null;
};

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BuildChamp recovered from a fatal render error.', error, info.componentStack);
  }

  private handleReset = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <FatalErrorState onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
