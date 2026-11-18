import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import QuickFill from './QuickFill';
import BrowserInstaller from './BrowserInstaller';
import QuickSearch from './quick-search/QuickSearch';
import './style.css';
import { installZoomShortcuts } from './zoom';
import { initLanguage, useLanguage } from './i18n';
installZoomShortcuts();

// The window root re-renders the whole tree when the language changes.
function Root() {
  useLanguage();
  return location.search.includes('browser-setup') ? (
    <BrowserInstaller />
  ) : location.search.includes('quick-fill') ? (
    <QuickFill />
  ) : location.search.includes('quick-search') ? (
    <QuickSearch />
  ) : (
    <App />
  );
}

void initLanguage().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  ),
);
