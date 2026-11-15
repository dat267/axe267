declare module "epubjs" {
  export interface EpubLocation {
    start: { cfi: string };
  }

  export interface EpubMetadata {
    title?: string;
  }

  export interface EpubNavItem {
    label?: string;
    href?: string;
    cfi?: string;
    subitems?: EpubNavItem[];
  }

  export interface EpubNavigation {
    toc: EpubNavItem[];
  }

  export interface EpubSearchResult {
    cfi: string;
    excerpt: string;
  }

  export interface EpubSection {
    href: string;
    cfi?: string;
    load(loader: (path: string) => Promise<unknown>): Promise<unknown>;
    find(query: string): EpubSearchResult[];
    unload(): void;
  }

  export interface EpubSpine {
    spineItems: EpubSection[];
    get(target: string): { cfi?: string } | undefined;
  }

  export interface EpubLocations {
    total: number;
    generate(chars: number): Promise<void>;
    load(json: string): Promise<void>;
    save(): string;
    percentageFromCfi(cfi: string): number;
  }

  export interface EpubContents {
    document: Document;
  }

  export interface EpubThemes {
    register(name: string, styles: Record<string, Record<string, string>>): void;
    select(name: string): void;
    font(name: string): void;
    fontSize(size: string): void;
  }

  export interface EpubHooks {
    content: { register(callback: (contents: EpubContents) => void): void };
  }

  export interface EpubRenditionOptions {
    width?: string;
    height?: string;
    flow?: string;
    manager?: string;
    spread?: string;
  }

  export interface EpubRendition {
    location?: EpubLocation | null;
    hooks: EpubHooks;
    themes: EpubThemes;
    display(target?: string): Promise<void>;
    next(): void;
    prev(): void;
    destroy(): void;
    on(event: "relocated", callback: (location: EpubLocation) => void): void;
  }

  export interface EpubBook {
    opened: Promise<unknown>;
    ready: Promise<unknown>;
    spine: EpubSpine;
    locations: EpubLocations;
    loaded: {
      metadata: Promise<EpubMetadata>;
      navigation: Promise<EpubNavigation>;
    };
    renderTo(element: HTMLElement, options?: EpubRenditionOptions): EpubRendition;
    canonical(target: string): string;
    destroy(): void;
    load(path: string): Promise<unknown>;
  }

  export type EpubInput = string | ArrayBuffer | Blob;

  export default function ePub(input: EpubInput): EpubBook;
}
