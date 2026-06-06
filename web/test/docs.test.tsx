import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { DocsPage } from "../src/components/DocsPage";
import { DOC_PAGES, rewriteDocHref, slugFromPath } from "../src/lib/docs";

describe("rewriteDocHref", () => {
  it("maps hosted/absolute/relative doc .md URLs to the rendered route", () => {
    expect(rewriteDocHref("https://heed.taiko.xyz/docs/cli.md")).toBe(
      "/docs/cli",
    );
    expect(rewriteDocHref("https://heed.taiko.xyz/docs/cli.md#errors")).toBe(
      "/docs/cli#errors",
    );
    expect(rewriteDocHref("/docs/core.md")).toBe("/docs/core");
  });

  it("leaves non-doc links unchanged", () => {
    expect(rewriteDocHref("https://heed.taiko.xyz/llms.txt")).toBe(
      "https://heed.taiko.xyz/llms.txt",
    );
    expect(rewriteDocHref("https://github.com/taikoxyz/heed")).toBe(
      "https://github.com/taikoxyz/heed",
    );
    expect(rewriteDocHref("#errors")).toBe("#errors");
  });
});

describe("slugFromPath", () => {
  it("resolves known slugs and falls back to the first page", () => {
    expect(slugFromPath("/docs")).toBe(DOC_PAGES[0].slug);
    expect(slugFromPath("/docs/")).toBe(DOC_PAGES[0].slug);
    expect(slugFromPath("/docs/cli")).toBe("cli");
    expect(slugFromPath("/docs/cli.md")).toBe("cli");
    expect(slugFromPath("/docs/nope")).toBe(DOC_PAGES[0].slug);
  });
});

describe("DocsPage", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/docs/cli");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("fetches and renders the active doc with sidebar navigation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => "# CLI Reference\n\nHello **world**.",
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <DocsPage />
      </ThemeProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: /CLI Reference/ }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/docs/cli.md");
    expect(
      screen.getByRole("link", { name: "Quickstart" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CLI reference" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
