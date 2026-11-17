import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import QuickFill from './QuickFill';
import BrowserInstaller from './BrowserInstaller';
import './style.css';
import { installZoomShortcuts } from './zoom';
installZoomShortcuts();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {location.search.includes('browser-setup') ? (
      <BrowserInstaller />
    ) : location.search.includes('quick-fill') ? (
      <QuickFill />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
