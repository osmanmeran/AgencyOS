import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import CloseRounded from '@mui/icons-material/CloseRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';

import { useT } from '@/lib/i18n/I18nContext';
import { createPageUrl } from '@/utils';
import {
  HOME_PAGE,
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  isHomeTab,
  loadTabs,
  makeTab,
  openTab,
  resolveTabLabels,
  saveTabs,
  tabKey,
} from '@/lib/pageTabs';

/**
 * The strip of open pages under the app bar. Every staff page you visit stays
 * here as a closeable tab until you close it, so a half-finished reservation
 * survives a detour into the supplier list.
 *
 * Which tab is active is read from the router, never stored — see lib/pageTabs.js.
 */
export default function PageTabs({ currentPageName }) {
  const theme = useTheme();
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();

  const [tabs, setTabs] = useState(loadTabs);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const activeRef = useRef(null);

  const activeKey = currentPageName ? tabKey(currentPageName, location.search) : null;

  useEffect(() => {
    if (!currentPageName) return;
    setTabs((prev) => openTab(prev, makeTab(currentPageName, location.search)));
  }, [currentPageName, location.search]);

  useEffect(() => {
    saveTabs(tabs);
  }, [tabs]);

  // Keep the tab you just navigated to visible when the strip has scrolled.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  const labels = useMemo(() => resolveTabLabels(tabs, t), [tabs, t]);

  const handleClose = (key) => {
    const { tabs: next, fallbackKey } = closeTab(tabs, key);
    setTabs(next);
    if (key === activeKey) navigate(fallbackKey);
  };

  const closeMenu = () => setMenuAnchor(null);

  const handleCloseOthers = () => {
    setTabs(closeOtherTabs(tabs, activeKey));
    closeMenu();
  };

  const handleCloseAll = () => {
    setTabs(closeAllTabs());
    closeMenu();
    navigate(createPageUrl(HOME_PAGE));
  };

  const activeTab = tabs.find((tab) => tab.key === activeKey);
  const canCloseActive = Boolean(activeTab) && !isHomeTab(activeTab);

  // Until a second page is open the strip is just chrome — stay out of the way.
  if (tabs.length < 2) return null;

  return (
    <Box
      role="tablist"
      aria-label={t('pageTabs.label')}
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 0.5,
        px: { xs: 2, sm: 3, lg: 4 },
        py: 0.75,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const label = labels.get(tab.key);
          const closable = !isHomeTab(tab);

          return (
            <Box
              key={tab.key}
              ref={isActive ? activeRef : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isActive ? 'primary.main' : 'divider',
                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                '&:hover': { borderColor: isActive ? 'primary.main' : 'text.disabled' },
              }}
            >
              <ButtonBase
                component={Link}
                to={tab.key}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: closable ? '7px 0 0 7px' : '7px',
                  maxWidth: 200,
                }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {label}
                </Typography>
              </ButtonBase>
              {closable && (
                <IconButton
                  size="small"
                  aria-label={t('pageTabs.close', { label })}
                  onClick={() => handleClose(tab.key)}
                  sx={{
                    p: 0.25,
                    mr: 0.5,
                    color: 'text.disabled',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  <CloseRounded sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      <Tooltip title={t('pageTabs.actions')}>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label={t('pageTabs.actions')}>
          <MoreHorizRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          disabled={!canCloseActive}
          onClick={() => {
            handleClose(activeKey);
            closeMenu();
          }}
        >
          {t('pageTabs.closeCurrent')}
        </MenuItem>
        <MenuItem onClick={handleCloseOthers}>{t('pageTabs.closeOthers')}</MenuItem>
        <MenuItem onClick={handleCloseAll}>{t('pageTabs.closeAll')}</MenuItem>
      </Menu>
    </Box>
  );
}
