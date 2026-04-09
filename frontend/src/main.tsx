import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import { SiteConfigProvider } from './contexts/SiteConfigContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <SiteConfigProvider>
      <App />
    </SiteConfigProvider>
  </ToastProvider>
);
