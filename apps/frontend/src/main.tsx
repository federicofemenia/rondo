import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import PwaChrome from './PwaChrome';
import { theme } from './theme';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error('Falta la variable de entorno VITE_CLERK_PUBLISHABLE_KEY.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <PwaChrome />
        <App />
      </ThemeProvider>
    </ClerkProvider>
  </React.StrictMode>,
);
