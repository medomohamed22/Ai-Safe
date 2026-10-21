import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Excalidraw's stylesheet loads with its lazy chunk (see SketchCanvas).
import './index.css';
import App from './App';
import {applyLanguage} from './lib/i18n';
import { ThemeProvider } from './components/ThemeProvider';

applyLanguage();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><App /></ThemeProvider>
  </StrictMode>,
);
