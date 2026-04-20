import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import { SiteConfigProvider } from './contexts/SiteConfigContext.tsx';
import './index.css';

const rootElement = document.getElementById('root');
createRoot(rootElement).render(
  <ToastProvider>
    <SiteConfigProvider>
      <App />
    </SiteConfigProvider>
  </ToastProvider>
);
