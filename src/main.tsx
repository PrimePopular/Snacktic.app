import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/variables.css';
import './styles/typography.css';
import './styles/global.css';
import './core/app.css';
import './shared/components/components.css';
import './styles/responsive.css';
import App from './core/App';
import { AuthProvider } from './features/authentication';
import { registerPwa } from './pwa/registration';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

registerPwa();
