import { db } from '@/lib/DbContext';

import { useState, useEffect, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useEntitySync } from '@/hooks/useEntitySync';
import { useReminderNotifications } from '@/hooks/useReminderNotifications';
import { useActAsClientId, clearActAsClient } from '@/lib/actAsClient';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import FlightTakeoffRounded from '@mui/icons-material/FlightTakeoffRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import AttachMoneyRounded from '@mui/icons-material/AttachMoneyRounded';
import InventoryRounded from '@mui/icons-material/InventoryRounded';
import RateReviewRounded from '@mui/icons-material/RateReviewRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import ShoppingCartRounded from '@mui/icons-material/ShoppingCartRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import LocalShippingRounded from '@mui/icons-material/LocalShippingRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import TourRounded from '@mui/icons-material/TourRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded';

import MarvelopsLogo from './components/layout/MarvelopsLogo';
import { PermissionProvider } from './components/permissions/PermissionContext';
import UserMenu from './components/layout/UserMenu';
import GlobalSearch from './components/layout/GlobalSearch';
import NotificationBell from './components/layout/NotificationBell';
import ThemeToggle from './components/layout/ThemeToggle';
import WorkspaceStatusBanner from './components/layout/WorkspaceStatusBanner';
import { useT } from '@/lib/i18n/I18nContext';
import { useCapacitorBackButton } from '@/lib/capacitorBackButton';

const DRAWER_WIDTH = 260;
const RAIL_WIDTH = 64;

const NAV_SECTIONS = {
  main: (t) => [
    { label: t('nav.dashboard'), icon: <DashboardRounded />, page: 'Dashboard' },
    {
      label: t('nav.reservations'),
      icon: <FlightTakeoffRounded />,
      page: 'Reservations',
      children: [
        { label: t('nav.newReservation'), page: 'CreateReservation' },
        { label: 'Calendar', page: 'CalendarView' },
        { label: 'Tour Contracts', page: 'TourContracts' },
        { label: 'Generate from Contract', page: 'GenerateFromContract' },
      ],
    },
    {
      label: t('nav.suppliers'),
      icon: <BusinessRounded />,
      page: 'Suppliers',
      children: [
        { label: t('nav.bookings'), page: 'SupplierBookings' },
        { label: 'RFP Manager', page: 'RFPManager' },
      ],
    },
    {
      label: t('nav.crm'),
      icon: <PeopleRounded />,
      page: 'ClientCRM',
      children: [{ label: 'Companies', page: 'Companies' }],
    },
    { label: 'Quote Requests', icon: <RequestQuoteRounded />, page: 'QuoteRequests' },
    { label: 'Tasks', icon: <TaskAltRounded />, page: 'TaskBoard' },
    {
      label: t('nav.tours') || 'Tours',
      icon: <TourRounded />,
      page: 'DailyTours',
      children: [
        { label: t('nav.dailyTours'), page: 'DailyTours' },
        { label: t('nav.multiDayTours'), page: 'MultiDayTours' },
      ],
    },
    // The client portal is entered per-client via "View portal as client" on a
    // CRM client record (see ClientDetails.jsx) — there is no generic staff
    // portal link, since the portal is meaningless without a client context.
  ],
  secondary: (t) => [
    {
      label: t('nav.revenue'),
      icon: <AttachMoneyRounded />,
      page: 'Revenue',
      children: [{ label: 'Commission Report', page: 'CommissionReport' }],
    },
    {
      label: t('nav.services'),
      icon: <InventoryRounded />,
      page: 'BookingTemplates',
      children: [
        { label: t('nav.templates'), page: 'BookingTemplates' },
        { label: t('nav.itineraryBuilder') || 'Itinerary Builder', page: 'ItineraryBuilder' },
      ],
    },
    { label: 'Getting Started', icon: <HelpOutlineRounded />, page: 'GettingStarted' },
  ],
  admin: (t) => [
    { label: 'User Management', icon: <PeopleRounded />, page: 'UserManagement' },
    {
      label: t('nav.settings'),
      icon: <SettingsRounded />,
      page: 'AppSettings',
      children: [{ label: t('nav.importHub'), page: 'ImportHub' }],
    },
    { label: 'Setup Guide', icon: <RocketLaunchRounded />, page: 'SetupWizard' },
    { label: 'Audit Trail', icon: <HistoryRounded />, page: 'AuditLogViewer' },
    { label: 'Testing', icon: <BuildRounded />, page: 'TestingArea' },
  ],
};

const CLIENT_NAV = (_t) => [
  { label: 'Home', icon: <DashboardRounded />, page: 'ClientPortal' },
  { label: 'Request a Quote', icon: <ShoppingCartRounded />, page: 'ClientQuoteBuilder' },
  { label: 'My Quote Requests', icon: <RequestQuoteRounded />, page: 'ClientQuotes' },
  { label: 'My Proposals', icon: <RateReviewRounded />, page: 'ClientProposals' },
  { label: 'My Trips', icon: <FlightTakeoffRounded />, page: 'ClientTrips' },
  { label: 'My Invoices', icon: <AssignmentRounded />, page: 'ClientInvoices' },
  { label: 'My Payments', icon: <ReceiptLongRounded />, page: 'ClientPayments' },
];

function NavItem({ item, currentPageName, depth = 0 }) {
  const [open, setOpen] = useState(false);
  //   const location = useLocation();
  const hasChildren = item.children?.length > 0;
  const isActive = currentPageName === item.page || item.children?.some((c) => c.page === currentPageName);
  const isExpanded = isActive || open;

  const content = (
    <ListItemButton
      component={Link}
      to={createPageUrl(item.page) + (item.query || '')}
      selected={isActive && !hasChildren}
      onClick={() => {
        if (hasChildren) setOpen(!open);
      }}
      sx={{
        pl: 2 + depth * 2,
        pr: 1.5,
        py: 1,
        mx: 1,
        mb: 0.25,
        borderRadius: '10px',
        minHeight: 42,
        '&.Mui-selected': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
          '&:hover': { bgcolor: 'primary.dark' },
        },
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: isActive ? 'inherit' : 'text.secondary' }}>{item.icon}</ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500 } } }}
      />
      {hasChildren && (
        <Box component="span" sx={{ color: 'text.secondary', display: 'flex' }}>
          {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </Box>
      )}
    </ListItemButton>
  );

  if (!hasChildren) return content;

  return (
    <>
      {content}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {item.children.map((child) => (
            <ListItemButton
              key={child.page}
              component={Link}
              to={createPageUrl(child.page)}
              selected={currentPageName === child.page}
              sx={{ pl: 6, pr: 1.5, py: 0.75, mx: 1, mb: 0.25, borderRadius: '10px', minHeight: 38 }}
            >
              <ListItemText
                primary={child.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: '0.8125rem',
                      fontWeight: currentPageName === child.page ? 600 : 400,
                      color: currentPageName === child.page ? 'primary.main' : 'text.secondary',
                    },
                  },
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Collapse>
    </>
  );
}

function RailNavItem({ item, currentPageName }) {
  const isActive = currentPageName === item.page || item.children?.some((c) => c.page === currentPageName);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Tooltip title={item.label} placement="right" disableInteractive enterDelay={200}>
        <ListItemButton
          component={item.page ? Link : 'div'}
          to={item.page ? createPageUrl(item.page) + (item.query || '') : undefined}
          selected={isActive}
          sx={{
            justifyContent: 'center',
            mx: 0.5,
            my: 0.25,
            width: 44,
            borderRadius: '10px',
            minHeight: 44,
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              justifyContent: 'center',
              color: isActive ? 'inherit' : 'text.secondary',
            }}
          >
            {item.icon}
          </ListItemIcon>
        </ListItemButton>
      </Tooltip>
    </Box>
  );
}

function SidebarContent({ currentPageName, t, isClientPortal, userTier, collapsed = false }) {
  const isAdmin = userTier === 'admin' || userTier === 'manager';
  // Staff viewing the portal "as" a client (via "View portal as client" on a
  // CRM record) still carry their own userTier (never 'client') — give them an
  // obvious way back instead of stranding them in the client-only nav.
  const isStaffPreviewingClient = isClientPortal && userTier && userTier !== 'client';
  const navSections = isClientPortal ? { main: () => CLIENT_NAV(t) } : NAV_SECTIONS;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 2, minHeight: '64px !important', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <Box
          component={Link}
          to={createPageUrl('Dashboard')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', justifyContent: 'center' }}
        >
          <MarvelopsLogo size={28} />
          {!collapsed && (
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Marvelops
            </Typography>
          )}
        </Box>
      </Toolbar>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {isStaffPreviewingClient && (
          <>
            {collapsed ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                <Tooltip title="Back to Operations" placement="right">
                  <ListItemButton
                    component={Link}
                    to={createPageUrl('Dashboard')}
                    onClick={clearActAsClient}
                    sx={{ justifyContent: 'center', mx: 0.5, width: 44, borderRadius: '10px', minHeight: 44 }}
                  >
                    <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', color: 'text.secondary' }}>
                      <ArrowBackRounded />
                    </ListItemIcon>
                  </ListItemButton>
                </Tooltip>
              </Box>
            ) : (
              <List disablePadding>
                <ListItemButton
                  component={Link}
                  to={createPageUrl('Dashboard')}
                  onClick={clearActAsClient}
                  sx={{ pl: 2, pr: 1.5, py: 1, mx: 1, mb: 0.25, borderRadius: '10px', minHeight: 42 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>
                    <ArrowBackRounded />
                  </ListItemIcon>
                  <ListItemText
                    primary="Back to Operations"
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 } } }}
                  />
                </ListItemButton>
              </List>
            )}
            <Divider sx={{ my: 1.5, mx: collapsed ? 1 : 2 }} />
          </>
        )}
        <List disablePadding>
          {navSections.main(t).map((item) => (
            <Fragment key={item.page + item.label}>
              {collapsed ? (
                <RailNavItem item={item} currentPageName={currentPageName} />
              ) : (
                <NavItem item={item} currentPageName={currentPageName} />
              )}
            </Fragment>
          ))}
        </List>
        {!isClientPortal && (
          <>
            <Divider sx={{ my: 1.5, mx: collapsed ? 1 : 2 }} />
            <List disablePadding>
              {navSections.secondary(t).map((item) => (
                <Fragment key={item.page + item.label}>
                  {collapsed ? (
                    <RailNavItem item={item} currentPageName={currentPageName} />
                  ) : (
                    <NavItem item={item} currentPageName={currentPageName} />
                  )}
                </Fragment>
              ))}
            </List>
            {isAdmin && (
              <>
                <Divider sx={{ my: 1.5, mx: collapsed ? 1 : 2 }} />
                <List disablePadding>
                  {navSections.admin(t).map((item) => (
                    <Fragment key={item.page + item.label}>
                      {collapsed ? (
                        <RailNavItem item={item} currentPageName={currentPageName} />
                      ) : (
                        <NavItem item={item} currentPageName={currentPageName} />
                      )}
                    </Fragment>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

export default function Layout({ children, currentPageName }) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const { t, setLanguage: setI18nLanguage } = useT();
  const navigate = useNavigate();

  // Staff "view portal as a client": resolve the impersonated client's name so
  // the banner can show whose portal they're looking at.
  const actAsClientId = useActAsClientId();
  const [actAsClient, setActAsClient] = useState(null);

  useEntitySync();
  useReminderNotifications();
  useCapacitorBackButton();

  useEffect(() => {
    db.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!actAsClientId) {
      setActAsClient(null);
      return;
    }
    let cancelled = false;
    db.entities.Client.get(actAsClientId)
      .then((c) => {
        if (!cancelled) setActAsClient(c);
      })
      .catch(() => {
        if (!cancelled) setActAsClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [actAsClientId]);

  const exitActAsClient = () => {
    clearActAsClient();
    navigate(createPageUrl('Dashboard'));
  };

  const isClientPortal =
    currentPageName?.startsWith('ClientPortal') ||
    currentPageName?.startsWith('ClientHotelSearch') ||
    currentPageName?.startsWith('ClientCarRentalSearch') ||
    currentPageName?.startsWith('ClientTransferSearch') ||
    currentPageName?.startsWith('ClientProposal') ||
    currentPageName?.startsWith('ClientTrip') ||
    currentPageName?.startsWith('ClientInvoice') ||
    currentPageName?.startsWith('ClientPayments') ||
    currentPageName?.startsWith('ClientQuote');

  const isSupplierPortal = currentPageName === 'SupplierPortal';

  // Desktop sidebar collapses to an icon rail (icons always visible, hover
  // reveals the label); the hamburger toggles between rail and full width.
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [collapsed, setCollapsed] = useState(true);
  const handleMenuToggle = () => {
    if (isDesktop) setCollapsed((c) => !c);
    else setMobileOpen((o) => !o);
  };

  const handleLanguageChange = async (lang) => {
    setI18nLanguage(lang);
    await db.auth.updateMe({ language: lang });
  };

  if (isSupplierPortal) {
    return (
      <PermissionProvider>
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <AppBar
            position="sticky"
            color="default"
            sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9), backdropFilter: 'blur(8px)' }}
          >
            <Toolbar>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'warning.main', width: 36, height: 36 }}>
                  <LocalShippingRounded fontSize="small" />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t('nav.supplierPortal')}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={user?.language || 'en'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  variant="outlined"
                  sx={{ fontSize: '0.875rem' }}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Español</MenuItem>
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="de">Deutsch</MenuItem>
                  <MenuItem value="it">Italiano</MenuItem>
                  <MenuItem value="tr">Türkçe</MenuItem>
                </Select>
              </FormControl>
            </Toolbar>
          </AppBar>
          <Box component="main" sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 4 }}>
            <WorkspaceStatusBanner />
            {children}
          </Box>
        </Box>
      </PermissionProvider>
    );
  }

  return (
    <PermissionProvider>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Desktop Sidebar */}
        <Box
          component="nav"
          sx={{
            width: { lg: collapsed ? RAIL_WIDTH : DRAWER_WIDTH },
            flexShrink: { lg: 0 },
            display: { xs: 'none', lg: 'block' },
          }}
        >
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: collapsed ? RAIL_WIDTH : DRAWER_WIDTH,
                boxSizing: 'border-box',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflowX: 'hidden',
                transition: theme.transitions.create('width', {
                  duration: theme.transitions.duration.enteringScreen,
                }),
              },
            }}
          >
            <SidebarContent
              currentPageName={currentPageName}
              t={t}
              isClientPortal={isClientPortal}
              userTier={user?.user_tier}
              collapsed={collapsed}
            />
          </Drawer>
        </Box>

        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
            },
          }}
        >
          <SidebarContent
            currentPageName={currentPageName}
            t={t}
            isClientPortal={isClientPortal}
            userTier={user?.user_tier}
            collapsed={false}
          />
        </Drawer>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top AppBar */}
          <AppBar
            position="sticky"
            color="default"
            sx={{
              bgcolor: alpha(theme.palette.background.paper, 0.85),
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Toolbar sx={{ minHeight: '56px !important', gap: 1 }}>
              <IconButton color="inherit" edge="start" onClick={handleMenuToggle}>
                <MenuIcon />
              </IconButton>

              <Box
                component={Link}
                to={createPageUrl('Dashboard')}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
              >
                <MarvelopsLogo size={28} />
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, color: 'text.primary', display: { xs: 'none', sm: 'block' } }}
                >
                  Marvelops
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }} />

              {!isClientPortal && (
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
                  <Tooltip title="New Reservation">
                    <IconButton
                      component={Link}
                      to={createPageUrl('CreateReservation')}
                      size="small"
                      sx={{ color: 'primary.main' }}
                    >
                      <AddRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="New Proposal">
                    <IconButton
                      component={Link}
                      to={createPageUrl('CreateProposal')}
                      size="small"
                      sx={{ color: 'primary.main' }}
                    >
                      <RateReviewRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                </Box>
              )}

              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <GlobalSearch />
              </Box>
              <ThemeToggle />
              <NotificationBell />
              <UserMenu />
            </Toolbar>
          </AppBar>

          {/* Staff "view portal as a client" banner */}
          {actAsClientId && isClientPortal && user && user.user_tier !== 'client' && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: { xs: 2, sm: 3, lg: 4 },
                py: 1,
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                borderBottom: '1px solid',
                borderColor: 'warning.main',
              }}
            >
              <VisibilityRounded fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                Viewing the client portal as {actAsClient?.name || 'this client'} — this is a read-only operations
                preview.
              </Typography>
              <Button
                size="small"
                color="inherit"
                variant="outlined"
                startIcon={<ArrowBackRounded fontSize="small" />}
                onClick={exitActAsClient}
              >
                Exit
              </Button>
            </Box>
          )}

          {/* Page Content */}
          <Box
            component="main"
            sx={{ flex: 1, px: { xs: 2, sm: 3, lg: 4 }, py: 3, maxWidth: 1400, width: '100%', mx: 'auto' }}
          >
            <WorkspaceStatusBanner />
            {children}
          </Box>
        </Box>
      </Box>
    </PermissionProvider>
  );
}
