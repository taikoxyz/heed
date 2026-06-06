export const DOC_PAGES = [
  { slug: "quickstart", title: "Quickstart", file: "/docs/quickstart.md" },
  { slug: "cli", title: "CLI reference", file: "/docs/cli.md" },
  { slug: "core", title: "@heed/core", file: "/docs/core.md" },
  { slug: "recipes", title: "Recipes", file: "/docs/recipes.md" },
] as const;

/** Resolve a `/docs[/<slug>]` pathname to a known doc slug (defaults to the first). */
export function slugFromPath(pathname: string): string {
  const slug = pathname.match(/^\/docs\/([a-z0-9-]+)/i)?.[1]?.toLowerCase();
  return DOC_PAGES.some((p) => p.slug === slug) ? slug! : DOC_PAGES[0].slug;
}

/**
 * Rewrite a raw doc-markdown URL (hosted, absolute, or root-relative) to the
 * in-app rendered route so internal cross-links keep readers in the viewer.
 * Everything else (llms.txt, GitHub, anchors) is returned unchanged.
 */
export function rewriteDocHref(href: string): string {
  const m = href.match(
    /^(?:https?:\/\/heed\.taiko\.xyz)?\/docs\/([a-z0-9-]+)\.md(#[^?]*)?$/i,
  );
  return m ? `/docs/${m[1].toLowerCase()}${m[2] ?? ""}` : href;
}
