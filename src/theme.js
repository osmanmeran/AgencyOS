import { createTheme } from '@mui/material/styles';

const pastel = {
  primary:    '#546E82', // dusty slate blue
  primaryLight: '#D4E4EC',
  primaryDark: '#3A5266',
  secondary:  '#7A6B59', // warm stone
  secondaryLight: '#EDE6DC',
  tertiary:   '#5A7D6A', // muted sage
  tertiaryLight: '#D8EBE1',
  error:      '#B05A54', // muted terracotta
  errorLight: '#F5E0DE',
  warning:    '#9E7C38', // muted amber
  warningLight: '#F3EAD4',
  success:    '#5A7D6A', // sage
  successLight: '#D8EBE1',
  bg:         '#F9F8F6', // warm off-white
  paper:      '#FFFFFF',
  textPrimary: '#1C1A17',
  textSecondary: '#6B6660',
  border:     '#E4DDD5',
  divider:    '#EDE8E2',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: pastel.primary,
      light: pastel.primaryLight,
      dark: pastel.primaryDark,
      contrastText: '#fff',
    },
    secondary: {
      main: pastel.secondary,
      light: pastel.secondaryLight,
      dark: '#5E5244',
      contrastText: '#fff',
    },
    success: { main: pastel.success, light: pastel.successLight, dark: '#3E5E4C', contrastText: '#fff' },
    warning: { main: pastel.warning, light: pastel.warningLight, dark: '#7A5E28', contrastText: '#fff' },
    error:   { main: pastel.error,   light: pastel.errorLight,   dark: '#8A3E3A', contrastText: '#fff' },
    info:    { main: pastel.primary, light: pastel.primaryLight, dark: pastel.primaryDark, contrastText: '#fff' },
    background: {
      default: pastel.bg,
      paper:   pastel.paper,
    },
    text: {
      primary:   pastel.textPrimary,
      secondary: pastel.textSecondary,
      disabled:  '#A8A09A',
    },
    divider: pastel.divider,
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 600, fontSize: '2.25rem', letterSpacing: '-0.025em', color: pastel.textPrimary },
    h2: { fontWeight: 600, fontSize: '1.875rem', letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, fontSize: '1.5rem',   letterSpacing: '-0.01em' },
    h4: { fontWeight: 500, fontSize: '1.25rem' },
    h5: { fontWeight: 500, fontSize: '1.1rem' },
    h6: { fontWeight: 500, fontSize: '1rem' },
    subtitle1: { fontWeight: 500, fontSize: '0.9375rem' },
    subtitle2: { fontWeight: 500, fontSize: '0.875rem', color: pastel.textSecondary },
    body1: { fontSize: '0.875rem', lineHeight: 1.65 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
    button: { fontWeight: 500, textTransform: 'none', letterSpacing: '0.005em' },
    caption: { fontSize: '0.75rem', color: pastel.textSecondary },
    overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: pastel.textSecondary },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    `0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)`,
    `0 2px 5px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)`,
    `0 3px 8px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)`,
    `0 4px 12px rgba(0,0,0,0.06), 0 2px 5px rgba(0,0,0,0.03)`,
    `0 6px 16px rgba(0,0,0,0.07), 0 3px 6px rgba(0,0,0,0.03)`,
    `0 8px 20px rgba(0,0,0,0.07), 0 3px 7px rgba(0,0,0,0.03)`,
    `0 10px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.03)`,
    `0 12px 28px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.03)`,
    `0 14px 32px rgba(0,0,0,0.09), 0 4px 9px rgba(0,0,0,0.03)`,
    `0 16px 36px rgba(0,0,0,0.09), 0 5px 10px rgba(0,0,0,0.03)`,
    `0 18px 40px rgba(0,0,0,0.10), 0 5px 10px rgba(0,0,0,0.03)`,
    `0 20px 44px rgba(0,0,0,0.10), 0 5px 11px rgba(0,0,0,0.03)`,
    `0 22px 48px rgba(0,0,0,0.11), 0 6px 12px rgba(0,0,0,0.03)`,
    `0 24px 52px rgba(0,0,0,0.11), 0 6px 12px rgba(0,0,0,0.03)`,
    `0 26px 56px rgba(0,0,0,0.12), 0 6px 13px rgba(0,0,0,0.03)`,
    `0 28px 60px rgba(0,0,0,0.12), 0 7px 14px rgba(0,0,0,0.03)`,
    `0 30px 64px rgba(0,0,0,0.12), 0 7px 14px rgba(0,0,0,0.03)`,
    `0 32px 68px rgba(0,0,0,0.13), 0 7px 15px rgba(0,0,0,0.03)`,
    `0 34px 72px rgba(0,0,0,0.13), 0 8px 15px rgba(0,0,0,0.03)`,
    `0 36px 76px rgba(0,0,0,0.14), 0 8px 16px rgba(0,0,0,0.03)`,
    `0 38px 80px rgba(0,0,0,0.14), 0 8px 16px rgba(0,0,0,0.03)`,
    `0 40px 84px rgba(0,0,0,0.14), 0 9px 17px rgba(0,0,0,0.03)`,
    `0 42px 88px rgba(0,0,0,0.15), 0 9px 17px rgba(0,0,0,0.03)`,
    `0 44px 92px rgba(0,0,0,0.15), 0 9px 18px rgba(0,0,0,0.03)`,
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { margin: 0, backgroundColor: pastel.bg },
        '::-webkit-scrollbar': { width: 6, height: 6 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': { background: pastel.border, borderRadius: 3 },
        '::-webkit-scrollbar-thumb:hover': { background: '#C4BAB0' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, padding: '7px 18px', fontWeight: 500, fontSize: '0.875rem', transition: 'all 0.15s ease' },
        sizeSmall: { padding: '5px 12px', fontSize: '0.8125rem' },
        sizeLarge: { padding: '10px 24px', fontSize: '0.9375rem' },
        contained: {
          backgroundColor: pastel.primary,
          '&:hover': { backgroundColor: pastel.primaryDark, boxShadow: '0 3px 10px rgba(84,110,130,0.25)' },
        },
        outlined: {
          borderColor: pastel.border,
          color: pastel.textPrimary,
          '&:hover': { borderColor: pastel.primary, backgroundColor: pastel.primaryLight + '40' },
        },
        text: {
          color: pastel.textSecondary,
          '&:hover': { backgroundColor: pastel.bg, color: pastel.textPrimary },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${pastel.divider}`,
          backgroundColor: pastel.paper,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12, backgroundImage: 'none' },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: `1px solid ${pastel.divider}` },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            fontSize: '0.875rem',
            backgroundColor: pastel.paper,
            '& fieldset': { borderColor: pastel.border },
            '&:hover fieldset': { borderColor: '#C4BAB0' },
            '&.Mui-focused fieldset': { borderColor: pastel.primary, borderWidth: 1.5 },
          },
          '& .MuiInputLabel-root': { fontSize: '0.875rem', color: pastel.textSecondary },
          '& .MuiInputLabel-root.Mui-focused': { color: pastel.primary },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 8, fontSize: '0.875rem' },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 6, fontSize: '0.75rem' },
        filled: {
          '&.MuiChip-colorPrimary':  { backgroundColor: pastel.primaryLight,  color: pastel.primaryDark },
          '&.MuiChip-colorSuccess':  { backgroundColor: pastel.tertiaryLight, color: '#3E5E4C' },
          '&.MuiChip-colorWarning':  { backgroundColor: pastel.warningLight,  color: '#7A5E28' },
          '&.MuiChip-colorError':    { backgroundColor: pastel.errorLight,    color: '#8A3E3A' },
        },
      },
    },
    MuiDialog: {
      defaultProps: { maxWidth: 'sm', fullWidth: true },
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: `1px solid ${pastel.divider}` },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: pastel.paper,
          borderBottom: `1px solid ${pastel.divider}`,
          color: pastel.textPrimary,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none', borderRight: `1px solid ${pastel.divider}` },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '1px 8px',
          padding: '7px 12px',
          '&:hover': { backgroundColor: pastel.bg },
          '&.Mui-selected': {
            backgroundColor: pastel.primaryLight,
            color: pastel.primaryDark,
            '&:hover': { backgroundColor: pastel.primaryLight },
            '& .MuiListItemIcon-root': { color: pastel.primaryDark },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36, color: pastel.textSecondary },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, minHeight: 44, fontSize: '0.875rem' },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, borderRadius: 1, backgroundColor: pastel.primary },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', padding: '11px 16px', borderColor: pastel.divider },
        head: {
          fontWeight: 600,
          color: pastel.textSecondary,
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          backgroundColor: pastel.bg,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
          '&:hover': { backgroundColor: `${pastel.bg}80` },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, fontSize: '0.8125rem' },
        standardSuccess: { backgroundColor: pastel.successLight, color: '#3E5E4C' },
        standardWarning: { backgroundColor: pastel.warningLight, color: '#7A5E28' },
        standardError:   { backgroundColor: pastel.errorLight,   color: '#8A3E3A' },
        standardInfo:    { backgroundColor: pastel.primaryLight,  color: pastel.primaryDark },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          borderRadius: 6,
          backgroundColor: pastel.textPrimary,
          padding: '5px 10px',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 3, backgroundColor: pastel.divider },
        bar:  { borderRadius: 3 },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { borderRadius: 8, backgroundColor: pastel.divider } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: pastel.divider } },
    },
  },
});

export default theme;
