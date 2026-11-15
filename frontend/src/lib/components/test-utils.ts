import { createRawSnippet, type Snippet } from "svelte";

/**
 * Wrap a plain string as a Svelte 5 snippet for use with `{@render children?.()}`.
 */
export const text = (str: string): Snippet => createRawSnippet(() => ({ render: () => `<span>${str}</span>` }));
