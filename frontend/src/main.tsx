import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
