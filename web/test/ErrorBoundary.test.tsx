import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MantineProvider } from "@mantine/core";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fallback when a child throws", () => {
    render(
      <MantineProvider>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MantineProvider>,
    );
    expect(screen.getByText("kaboom")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>safe</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe")).toBeTruthy();
  });

  it("uses a custom fallback and can reset", () => {
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error("nope");
      return <div>recovered</div>;
    }
    render(
      <ErrorBoundary
        fallback={(e, reset) => <button onClick={reset}>{e.message}</button>}
      >
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText("nope")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByText("nope"));
    expect(screen.getByText("recovered")).toBeTruthy();
  });
});
