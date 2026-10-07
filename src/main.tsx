import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startScheduler } from './services/scheduler';
import { initSync } from './store/sync';
import './styles.css';

initSync();
startScheduler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
