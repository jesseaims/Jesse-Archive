// Bundled by tests/quick-search-ui.test.mjs (esbuild) and run inside jsdom: mounts the
// real Quick Search window.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import QuickSearch from '../../src/quick-search/QuickSearch';

let root: Root | null = null;

export async function mount(container: HTMLElement) {
  await act(async () => {
    root = createRoot(container);
    root.render(<QuickSearch />);
  });
}
export async function unmount() {
  await act(async () => root?.unmount());
  root = null;
}
export { act };
