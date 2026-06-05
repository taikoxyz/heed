import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="break-words">{error.message}</div>
        <button onClick={this.reset} className="underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }
}
