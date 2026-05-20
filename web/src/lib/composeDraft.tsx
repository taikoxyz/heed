import { createContext, useContext } from "react";

export interface ComposeDraft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}

export interface ComposeApi {
  draft: ComposeDraft | null;
  openCompose: (draft: Partial<ComposeDraft>) => void;
  clearDraft: () => void;
}

export const ComposeContext = createContext<ComposeApi | null>(null);

export function useCompose(): ComposeApi {
  const ctx = useContext(ComposeContext);
  if (!ctx) {
    throw new Error("useCompose must be used within a ComposeContext provider");
  }
  return ctx;
}
