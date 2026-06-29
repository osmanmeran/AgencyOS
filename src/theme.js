import { createTheme } from '@mui/material/styles';
import { blue, grey, green, red, amber } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#fff',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#fff',
    },
    success: { main: '#2e7d32', light: '#60ad5e', dark: '#005005' },
    warning: { main: '#ed6c02', light: '#ff9800', dark: '#e65100' },
    error: { main: '#d32f2f', light: '#ef5350', dark: '#c62828' },
    info: { main: '#0288d1', light: '#03a9f4', dark: '#01579b' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: grey[900],
      secondary: grey[600],
    },
    divider: grey[200],
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.5rem' },
    h4: { fontWeight: 600, fontSize: '1.25rem' },
    h5: { fontWeight: 600, fontSize: '1.1rem' },
    h6: { fontWeight: 600, fontSize: '1rem' },
    subtitle1: { fontWeight: 500, fontSize: '1rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.875rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    caption: { fontSize: '0.75rem', color: grey[500] },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    '0 2px 6px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
    '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    '0 6px 16px rgba(0,0,0,0.08), 0 3px 6px rgba(0,0,0,0.04)',
    '0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
    '0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
    '0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.04)',
    '0 16px 40px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.04)',
    '0 16px 40px rgba(0,0,0,0.14), 0 6px 10px rgba(0,0,0,0.04)',
    '0 20px 48px rgba(0,0,0,0.14), 0 6px 10px rgba(0,0,0,0.04)',
    '0 20px 48px rgba(0,0,0,0.16), 0 6px 10px rgba(0,0,0,0.04)',
    '0 24px 56px rgba(0,0,0,0.16), 0 6px 10px rgba(0,0,0,0.04)',
    '0 24px 56px rgba(0,0,0,0.18), 0 6px 10px rgba(0,0,0,0.04)',
    '0 28px 64px rgba(0,0,0,0.18), 0 6px 10px rgba(0,0,0,0.04)',
    '0 28px 64px rgba(0,0,0,0.20), 0 6px 10px rgba(0,0,0,0.04)',
    '0 32px 72px rgba(0,0,0,0.20), 0 6px 10px rgba(0,0,0,0.04)',
    '0 32px 72px rgba(0,0,0,0.22), 0 6px 10px rgba(0,0,0,0.04)',
    '0 36px 80px rgba(0,0,0,0.22), 0 6px 10px rgba(0,0,0,0.04)',
    '0 36px 80px rgba(0,0,0,0.24), 0 6px 10px rgba(0,0,0,0.04)',
    '0 40px 88px rgba(0,0,0,0.24), 0 6px 10px rgba(0,0,0,0.04)',
    '0 40px 88px rgba(0,0,0,0.26), 0 6px 10px rgba(0,0,0,0.04)',
    '0 44px 96px rgba(0,0,0,0.26), 0 6px 10px rgba(0,0,0,0.04)',
    '0 44px 96px rgba(0,0,0,0.28), 0 6px 10px rgba(0,0,0,0.04)',
    '0 48px 104px rgba(0,0,0,0.28), 0 6px 10px rgba(0,0,0,0.04)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box' },
        body: { margin: 0, backgroundColor: '#f5f5f5' },
        '::-webkit-scrollbar': { width: 8, height: 8 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: grey[300], borderRadius: 4 },
        '::-webkit-scrollbar-thumb:hover': { background: grey[400] },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, padding: '8px 20px', fontWeight: 600, fontSize: '0.875rem' },
        sizeSmall: { padding: '6px 14px', fontSize: '0.8125rem' },
        sizeLarge: { padding: '12px 28px', fontSize: '0.9375rem' },
        contained: { '&:hover': { boxShadow: '0 4px 12px rgba(25,118,210,0.3)' } },
        outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 16, border: `1px solid ${grey[200]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            fontSize: '0.875rem',
            '& fieldset': { borderColor: grey[300] },
            '&:hover fieldset': { borderColor: grey[400] },
            '&.Mui-focused fieldset': { borderWidth: 2 },
          },
          '& .MuiInputLabel-root': { fontSize: '0.875rem' },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.875rem' },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8, fontSize: '0.75rem' },
        filled: { '&.MuiChip-colorPrimary': { color: '#fff' } },
      },
    },
    MuiDialog: {
      defaultProps: { maxWidth: 'sm', fullWidth: true },
      styleOverrides: {
        paper: { borderRadius: 20, boxShadow: '0 24px 56px rgba(0,0,0,0.16)' },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none', borderBottom: `1px solid ${grey[200]}` },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRadius: '0 16px 16px 0', border: 'none' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, minHeight: 48 },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 3, borderRadius: 2 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', padding: '12px 16px' },
        head: { fontWeight: 600, color: grey[600], fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:last-child td': { borderBottom: 0 } },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { width: 42, height: 26, padding: 0 },
        switchBase: { padding: 1, '&.Mui-checked': { transform: 'translateX(16px)', '& + .MuiSwitch-track': { opacity: 1 } } },
        thumb: { width: 22, height: 22 },
        track: { borderRadius: 13, opacity: 1, backgroundColor: grey[300] },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontSize: '0.8125rem' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: '0.75rem', borderRadius: 8, backgroundColor: grey[800], padding: '6px 12px' },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: { fontWeight: 600, fontSize: '0.6875rem' },
      },
    },
    MuiCircularProgress: {
      styleOverrides: { root: { color: blue[600] } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4, backgroundColor: grey[200] }, bar: { borderRadius: 4 } },
    },
    MuiSkeleton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
  },
});

export default theme;
