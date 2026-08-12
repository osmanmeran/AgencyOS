import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Settings, Globe, Coins, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { useSupportedCurrencies, getCurrencyName } from '@/lib/currencies';
import { getCurrencySymbol } from '@/lib/formatters';
import { getCatalog } from '@/lib/b2bApi';
import { showError } from '@/lib/toast';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'Türkçe' },
];

/**
 * Client-portal preferences (language + display currency), shown in the top
 * bar so a client can change them without going through their travel agent.
 *
 * Currency is a server-side setting on purpose: the B2B catalog is converted
 * to the display currency in `/api/b2b/catalog` (rates live server-side), so
 * picking one here persists it on the user and refetches the catalog rather
 * than converting anything in the browser. It's a *display* preference —
 * `Client.preferred_currency`, the billing currency invoices are issued in,
 * is left alone and still applies whenever the client hasn't picked one.
 */
export default function PortalSettingsMenu() {
  const [user, setUser] = useState(null);
  const { t, language, setLanguage } = useT();
  const supportedCurrencies = useSupportedCurrencies();
  const queryClient = useQueryClient();

  useEffect(() => {
    db.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  // Shares the cache key every portal page already uses, so this reads the
  // catalog's effective currency without issuing a request of its own.
  const { data: catalog } = /** @type {any} */ (
    useQuery({
      queryKey: ['b2bCatalog'],
      queryFn: getCatalog,
      enabled: !!user?.client_id,
    })
  );

  // Only a real portal account can override the currency — for staff using
  // "view portal as this client" the server deliberately keeps the client's
  // own currency, so offering the control there would do nothing.
  const canChooseCurrency = !!user?.client_id;
  const activeCurrency = user?.portal_currency || catalog?.currency || '';

  const handleLanguageChange = async (lang) => {
    setLanguage(lang);
    try {
      const updated = await db.auth.updateMe({ language: lang });
      setUser(updated);
    } catch {
      showError(t('portalSettings.saveFailed'));
    }
  };

  const handleCurrencyChange = async (code) => {
    if (code === activeCurrency) return;
    try {
      const updated = await db.auth.updateMe({ portal_currency: code });
      setUser(updated);
      // Prices are converted server-side, so the catalog has to come back.
      await queryClient.invalidateQueries({ queryKey: ['b2bCatalog'] });
    } catch {
      showError(t('portalSettings.saveFailed'));
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('portalSettings.title')}>
          <Settings className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('portalSettings.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Globe className="w-4 h-4 mr-2" />
            <span className="flex-1">{t('portalSettings.language')}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {LANGUAGES.find((l) => l.code === language)?.label || language}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                className="cursor-pointer"
                onClick={() => handleLanguageChange(lang.code)}
              >
                {language === lang.code ? (
                  <Check className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-300" />
                ) : (
                  <span className="w-4 h-4 mr-2" />
                )}
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {canChooseCurrency && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Coins className="w-4 h-4 mr-2" />
              <span className="flex-1">{t('portalSettings.currency')}</span>
              {activeCurrency && <span className="text-xs text-muted-foreground ml-2">{activeCurrency}</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              {supportedCurrencies.map((code) => (
                <DropdownMenuItem key={code} className="cursor-pointer" onClick={() => handleCurrencyChange(code)}>
                  {activeCurrency === code ? (
                    <Check className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-300" />
                  ) : (
                    <span className="w-4 h-4 mr-2" />
                  )}
                  <span className="w-8 shrink-0">{getCurrencySymbol(code)}</span>
                  <span className="truncate">
                    {code} — {getCurrencyName(code)}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {canChooseCurrency && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('portalSettings.currencyHint')}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
