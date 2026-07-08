import { db } from '@/lib/DbContext';

import { useState, useEffect } from 'react';

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
import {
  User,
  LogOut,
  Mail,
  Shield,
  Globe,
  Check,
  HelpCircle,
  FlaskConical,
  Lightbulb,
  UserCircle,
} from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import SuggestionDialog from '@/components/suggestions/SuggestionDialog';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'tr', label: 'Türkçe' },
];

export default function UserMenu() {
  const [user, setUser] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const { t, language, setLanguage } = useT();

  useEffect(() => {
    db.auth
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleLogout = () => {
    db.auth.logout();
  };

  const handleLanguageChange = async (lang) => {
    setLanguage(lang);
    await db.auth.updateMe({ language: lang });
  };

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={() => db.auth.redirectToLogin()}>
        <User className="w-4 h-4 mr-2" />
        {t('userMenu.login')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="hidden md:block text-sm font-medium text-foreground max-w-32 truncate">
            {user.full_name || user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.full_name || t('userMenu.defaultUser')}</p>
            <p className="text-xs leading-none text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
            {user.role && (
              <p className="text-xs leading-none text-muted-foreground flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3" />
                {t('userMenu.roleLabel', { role: user.role })}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <Globe className="w-4 h-4 mr-2" />
            {t('userMenu.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                className="cursor-pointer"
                onClick={() => handleLanguageChange(lang.code)}
              >
                {language === lang.code && <Check className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-300" />}
                {language !== lang.code && <span className="w-4 h-4 mr-2" />}
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = '/Profile')}>
          <UserCircle className="w-4 h-4 mr-2" />
          {t('userMenu.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => {
            setSuggestOpen(true);
          }}
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          {t('userMenu.suggestFeature')}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = '/FAQ')}>
          <HelpCircle className="w-4 h-4 mr-2" />
          {t('userMenu.faq')}
        </DropdownMenuItem>
        {(user.user_tier === 'admin' || user.role === 'admin') && (
          <>
            <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = '/SuggestionsManager')}>
              <Lightbulb className="w-4 h-4 mr-2" />
              {t('userMenu.manageSuggestions')}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = '/TestingArea')}>
              <FlaskConical className="w-4 h-4 mr-2" />
              {t('testingArea.title')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <SuggestionDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
        <DropdownMenuItem className="text-red-600 dark:text-red-300 cursor-pointer" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t('userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
