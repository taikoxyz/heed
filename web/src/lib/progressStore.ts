import { useEffect, useState } from "react";

// Per-key progress state that survives component unmount. Required so that a
// long-running `queryFn` (e.g. an inbox scan) can keep reporting progress to
// the latest mounted observer after the user switches tabs and comes back.

type Listener = (value: number) => void;
const values = new Map<string, number>();
const listeners = new Map<string, Set<Listener>>();

export function setProgress(key: string, value: number): void {
  values.set(key, value);
  const set = listeners.get(key);
  if (set) for (const l of set) l(value);
}

export function getProgress(key: string): number {
  return values.get(key) ?? 0;
}

export function useProgress(key: string): number {
  const [value, setValue] = useState(() => getProgress(key));
  useEffect(() => {
    setValue(getProgress(key));
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(setValue);
    return () => {
      set!.delete(setValue);
      if (set!.size === 0) listeners.delete(key);
    };
  }, [key]);
  return value;
}
