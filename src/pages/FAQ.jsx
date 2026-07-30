import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ChevronDown,
  ChevronRight,
  Search,
  HelpCircle,
  Mail,
  FileText,
  Users,
  Shield,
  FileDown,
  Calendar,
  SendHorizontal,
  DollarSign,
  Building2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';

const CATEGORIES = [
  { key: 'general', icon: HelpCircle },
  { key: 'account', icon: Users },
  { key: 'bookings', icon: FileText },
  { key: 'tasks', icon: Calendar },
  { key: 'suppliers', icon: SendHorizontal },
  { key: 'email', icon: Mail },
  { key: 'permissions', icon: Shield },
  { key: 'documents', icon: FileDown },
  { key: 'finance', icon: DollarSign },
  { key: 'saas', icon: Building2 },
];

const FAQS = [
  { key: 'newBooking', category: 'bookings' },
  { key: 'newProposal', category: 'bookings' },
  { key: 'sendInvoice', category: 'bookings' },
  { key: 'resetPassword', category: 'account' },
  { key: 'addUser', category: 'permissions' },
  { key: 'userTiers', category: 'permissions' },
  { key: 'attachFile', category: 'documents' },
  { key: 'downloadPdf', category: 'documents' },
  { key: 'sendEmails', category: 'email' },
  { key: 'realtimeNotifications', category: 'email' },
  { key: 'changeLanguage', category: 'general' },
  { key: 'darkMode', category: 'general' },
  { key: 'auditTrail', category: 'general' },
  { key: 'globalSearch', category: 'general' },
  { key: 'customizeInvoice', category: 'general' },
  { key: 'uploadFileTypes', category: 'documents' },
  { key: 'importData', category: 'general' },
  { key: 'sessionExpiry', category: 'account' },
  { key: 'calendarView', category: 'tasks' },
  { key: 'taskBoardWork', category: 'tasks' },
  { key: 'autoTasks', category: 'tasks' },
  { key: 'departureDateChange', category: 'tasks' },
  { key: 'slaFlags', category: 'tasks' },
  { key: 'rfpWizard', category: 'suppliers' },
  { key: 'commissionTracking', category: 'finance' },
  { key: 'quoteRequestOnline', category: 'general' },
  { key: 'b2bQuoting', category: 'bookings' },
  { key: 'multiCurrencyDashboard', category: 'finance' },
  { key: 'automatedReminders', category: 'email' },
  { key: 'supplierColumns', category: 'suppliers' },
  { key: 'supplierSearchWeb', category: 'suppliers' },
  { key: 'workspaceWhat', category: 'saas' },
  { key: 'workspaceOpen', category: 'saas' },
  { key: 'workspaceDataSeparate', category: 'saas' },
  { key: 'workspaceMicrosoftSso', category: 'saas' },
  { key: 'workspaceCreate', category: 'saas' },
  { key: 'workspaceOneLogin', category: 'saas' },
  { key: 'workspaceSelfServe', category: 'saas' },
  { key: 'workspaceAddressValid', category: 'saas' },
  { key: 'workspaceSettingsFaq', category: 'saas' },
  { key: 'workspaceTrialSuspend', category: 'saas' },
  { key: 'workspaceFileBackupIsolation', category: 'saas' },
];

export default function FAQ() {
  const { t: _t } = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openItems, setOpenItems] = useState(new Set());

  const filtered = FAQS.filter((faq) => {
    const q = _t(`faq.items.${faq.key}.q`);
    const a = _t(`faq.items.${faq.key}.a`);
    const matchesSearch =
      !search || q.toLowerCase().includes(search.toLowerCase()) || a.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleItem = (index) => {
    const next = new Set(openItems);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setOpenItems(next);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{_t('faq.frequently')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{_t('faq.find')}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder={_t('faq.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {_t('faq.all')}
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {_t(`faq.categories.${cat.key}`)}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">{_t('faq.no')}</h3>
            <p className="text-sm text-slate-400 mt-1">{_t('faq.try')}</p>
          </Card>
        ) : (
          filtered.map((faq, _i) => {
            const idx = FAQS.indexOf(faq);
            const isOpen = openItems.has(idx);
            const cat = CATEGORIES.find((c) => c.key === faq.category);
            const CatIcon = cat?.icon || HelpCircle;
            return (
              <Card
                key={idx}
                className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer dark:bg-slate-900 dark:border-slate-700"
                onClick={() => toggleItem(idx)}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 mt-0.5 flex-shrink-0">
                      <CatIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {_t(`faq.items.${faq.key}.q`)}
                        </h3>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform" />
                        )}
                      </div>
                      {isOpen && (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {_t(`faq.items.${faq.key}.a`)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="text-center py-8">
        <p className="text-sm text-slate-400 dark:text-slate-500">{_t('faq.still')}</p>
      </div>
    </div>
  );
}
