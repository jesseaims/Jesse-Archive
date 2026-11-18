// Bundled by tests/dashboard-ui.test.mjs (esbuild) and run inside jsdom: mounts the
// real dashboard with the props App.tsx passes.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import Dashboard from '../../src/dashboard/Dashboard';

type Props = Parameters<typeof Dashboard>[0];
let root: Root | null = null;

export async function mount(container: HTMLElement, props: Props) {
  await act(async () => {
    root = createRoot(container);
    root.render(<Dashboard {...props} />);
  });
}
export async function update(props: Props) {
  await act(async () => root?.render(<Dashboard {...props} />));
}
export async function unmount() {
  await act(async () => root?.unmount());
  root = null;
}
export { act };
