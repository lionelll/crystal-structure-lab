import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApplicationErrorBoundary } from './components/ApplicationErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApplicationErrorBoundary>
      <App />
    </ApplicationErrorBoundary>
  </React.StrictMode>,
);
