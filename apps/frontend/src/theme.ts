import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2ECC71',
      dark: '#1DB954',
      light: '#4DE988',
      contrastText: '#0B0D0F',
    },
    background: {
      default: '#0B0D0F',
      paper: '#121417',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8D9A98',
    },
    divider: '#2A3439',
    success: { main: '#2ECC71' },
    warning: { main: '#F5C542' },
    error: { main: '#FF4D4F' },
    info: { main: '#4DA3FF' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h1: { fontSize: '2rem', lineHeight: 40 / 32, fontWeight: 700 },
    h2: { fontSize: '1.5rem', lineHeight: 32 / 24, fontWeight: 600 },
    h3: { fontSize: '1.25rem', lineHeight: 28 / 20, fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 24 / 16, fontWeight: 400 },
    body2: { fontSize: '0.875rem', lineHeight: 20 / 14, fontWeight: 400 },
    caption: { fontSize: '0.75rem', lineHeight: 16 / 12, fontWeight: 500 },
  },
  spacing: 4,
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 16, backgroundImage: 'none' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 700 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
  },
});
