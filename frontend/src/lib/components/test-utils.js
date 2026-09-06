import { createRawSnippet } from "svelte";

/**
 * Wrap a plain string as a Svelte 5 snippet for use with `{@render children?.()}`.
 *
 * @param {string} str
 * @returns {ReturnType<typeof createRawSnippet>}
 */
export const text = (str) => createRawSnippet(() => ({ render: () => `<span>${str}</span>` }));

/**
 * Wrap an HTML string as a Svelte 5 snippet.
 *
 * @param {string} html
 * @returns {ReturnType<typeof createRawSnippet>}
 */
export const html = (html) => createRawSnippet(() => ({ render: () => html }));
