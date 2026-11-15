/**
 * Minimal ambient declarations for the Bun APIs used by `serve.ts`.
 * The frontend is compiled with Bun only for release binaries; the rest of
 * the app is checked against the DOM and Node types.
 */
declare const Bun: {
  serve(options: { port: string | number; fetch(request: Request): Response | Promise<Response> }): unknown;
  file(path: string): Blob & { exists(): Promise<boolean> };
};

interface ImportMeta {
  readonly dir: string;
}
