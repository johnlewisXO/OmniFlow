import React from 'react';
import { createRoot } from 'react-dom/client'; // Correct import for React 18+
import App from './App'; // Ensure relative path

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement); // Use createRoot from react-dom/client
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);