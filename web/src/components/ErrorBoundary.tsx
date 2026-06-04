import { Component, type ReactNode } from "react";
import { Alert, Anchor, Stack } from "@mantine/core";

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
      <Alert color="red" variant="light" m="md">
        <Stack gap="xs">
          <div style={{ wordBreak: "break-word" }}>{error.message}</div>
          <Anchor component="button" onClick={this.reset} c="red">
            Try again
          </Anchor>
        </Stack>
      </Alert>
    );
  }
}
