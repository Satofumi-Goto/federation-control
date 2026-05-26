import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FederationRoutes } from './federation/routes/federationRoutes';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FederationRoutes />
    </BrowserRouter>
  </StrictMode>,
);
