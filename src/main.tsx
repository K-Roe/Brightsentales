import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { recoverCoordinatedRestore } from './restoreCoordinator';
import { readAppearance, resolveAppearance } from './appearance';
import './style.css';
import './theme.css';
import './music-studio.css';
import './voice-studio.css';

const appearance = readAppearance();
document.documentElement.dataset.theme = resolveAppearance(appearance, window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);

const root = createRoot(document.getElementById('root')!);
void (async () => {
  try {
    const result = await recoverCoordinatedRestore(window.localStorage);
    if (!result.ok) throw new Error(result.error);
    root.render(<React.StrictMode><App /></React.StrictMode>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Studio storage recovery failed.';
    root.render(<main role="alert"><h1>Studio recovery needs attention</h1><p>{message}</p><p>Reload to retry. Your stored data has not been cleared.</p></main>);
  }
})();
