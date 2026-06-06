import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { HeedWordmark } from "./HeedWordmark";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOC_PAGES, rewriteDocHref, slugFromPath } from "@/lib/docs";

const REPO = "https://github.com/taikoxyz/heed";

const components: Components = {
  a(props) {
    const to = rewriteDocHref(props.href ?? "");
    const external = /^https?:\/\//i.test(to);
    return (
      <a
        href={to}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {props.children}
      </a>
    );
  },
};

export function DocsPage() {
  const slug =
    typeof window !== "undefined"
      ? slugFromPath(window.location.pathname)
      : DOC_PAGES[0].slug;
  const page = DOC_PAGES.find((p) => p.slug === slug)!;
  const [state, setState] = useState<{
    status: "loading" | "ok" | "error";
    text?: string;
    error?: string;
  }>({ status: "loading" });

  useEffect(() => {
    document.title = `${page.title} — Heed docs`;
  }, [page.title]);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetch(page.file)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => alive && setState({ status: "ok", text }))
      .catch(
        (e) =>
          alive &&
          setState({ status: "error", error: String(e?.message ?? e) }),
      );
    return () => {
      alive = false;
    };
  }, [page.file]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
        <a href="/" className="flex min-w-0 items-center gap-3">
          <HeedWordmark className="h-6 w-auto shrink-0 text-foreground" />
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <span className="label-mono hidden sm:block">Docs</span>
        </a>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <a href="/llms.txt">llms.txt</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <a href="/">Launch app</a>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-border md:sticky md:top-[60px] md:h-[calc(100vh-60px)] md:w-60 md:border-b-0 md:border-r">
          <nav
            aria-label="Docs"
            className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3"
          >
            {DOC_PAGES.map((p) => {
              const active = p.slug === slug;
              return (
                <a
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center rounded-md px-3 py-2 font-mono text-xs font-medium tracking-wider whitespace-nowrap uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      className="absolute inset-y-1.5 left-0 hidden w-[3px] rounded-full bg-signal md:block"
                      aria-hidden
                    />
                  )}
                  {p.title}
                </a>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
          <article className="doc-prose mx-auto w-full max-w-3xl">
            {state.status === "loading" && (
              <p className="label-mono">Loading…</p>
            )}
            {state.status === "error" && (
              <p className="text-destructive">
                Couldn’t load this page ({state.error}). Read it as{" "}
                <a href={page.file}>raw Markdown</a> instead.
              </p>
            )}
            {state.status === "ok" && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
              >
                {state.text}
              </ReactMarkdown>
            )}
          </article>

          <footer className="mx-auto mt-12 w-full max-w-3xl border-t border-border pt-6 font-mono text-xs text-muted-foreground">
            <a className="hover:text-foreground" href={page.file}>
              View raw Markdown
            </a>{" "}
            ·{" "}
            <a className="hover:text-foreground" href="/llms.txt">
              llms.txt
            </a>{" "}
            ·{" "}
            <a
              className="hover:text-foreground"
              href={`${REPO}/tree/main/docs`}
              target="_blank"
              rel="noopener noreferrer"
            >
              docs on GitHub
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
