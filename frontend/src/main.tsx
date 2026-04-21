import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import { SiteConfigProvider } from './contexts/SiteConfigContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}
createRoot(rootElement).render(
  <AuthProvider>
    <ToastProvider>
      <SiteConfigProvider>
        <App />
      </SiteConfigProvider>
    </ToastProvider>
  </AuthProvider>
);
