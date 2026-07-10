import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  FileText,
  Upload,
  Shield,
  RefreshCw,
  Database,
  Plus,
  Trash2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/I18nContext';
import { getCsrfToken } from '@/lib/csrf';

async function api(path, opts = {}) {
  const csrfToken = getCsrfToken();
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...opts.headers,
    },
    credentials: 'include',
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    // Server errors come back as { error: { code, message } }. Surface the
    // human-readable message — passing the object straight to Error() (as the
    // callers used to) stringifies it to the useless "[object Object]".
    const e = data?.error;
    const msg =
      (e && typeof e === 'object' && (e.message || e.code)) ||
      (typeof e === 'string' ? e : null) ||
      res.statusText ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export default function TestingArea() {
  const { t } = useT();
  const { user } = useAuth();
  const [results, setResults] = useState(/** @type {any} */ ({}));
  const [loading, setLoading] = useState(/** @type {any} */ ({}));

  const addResult = (key, data) => {
    const status = data?.error ? 'fail' : 'pass';
    setResults((prev) => ({ ...prev, [key]: { status, data, timestamp: new Date().toLocaleTimeString() } }));
  };

  const runTest = async (key, fn) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await fn();
      addResult(key, data);
    } catch (err) {
      addResult(key, { error: err.message });
    }
    setLoading((prev) => ({ ...prev, [key]: false }));
  };

  if (!user || (user.user_tier !== 'admin' && user.role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">{t('testingArea.adminAccessRequired')}</h2>
        <p className="text-muted-foreground mt-2">{t('testingArea.adminAccessRequiredBody')}</p>
      </div>
    );
  }

  const TestCard = ({ title, description, children, testKey, action }) => (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {action && (
          <Button size="sm" variant="outline" onClick={() => runTest(testKey, action)} disabled={loading[testKey]}>
            {loading[testKey] ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {t('testingArea.run')}
          </Button>
        )}
      </div>
      {children}
      {results[testKey] && (
        <div
          className={`rounded-lg p-3 text-sm font-mono ${results[testKey].status === 'pass' ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}
        >
          <div className="flex items-center gap-1 mb-1">
            {results[testKey].status === 'pass' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="font-semibold">
              {results[testKey].status === 'pass' ? t('testingArea.ok') : t('testingArea.fail')}
            </span>
            <span className="text-xs opacity-60 ml-auto">{results[testKey].timestamp}</span>
          </div>
          <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(results[testKey].data, null, 2)}</pre>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-xl">
          <Shield className="w-6 h-6 text-amber-700 dark:text-amber-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('testingArea.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('testingArea.subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">{t('testingArea.tabFeatureTests')}</TabsTrigger>
          <TabsTrigger value="users">{t('testingArea.tabTestUsers')}</TabsTrigger>
          <TabsTrigger value="system">{t('testingArea.tabSystem')}</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TestCard
              title={t('testingArea.emailServiceTitle')}
              description={t('testingArea.emailServiceDesc')}
              testKey="email"
              action={async () => {
                const data = await api('/api/email/test', { method: 'POST' });
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                {t('testingArea.emailServiceBody')}
              </div>
            </TestCard>

            <TestCard
              title={t('testingArea.pdfGenerationTitle')}
              description={t('testingArea.pdfGenerationDesc')}
              testKey="pdf"
              action={async () => {
                const data = await api('/api/pdf/test', { method: 'POST' });
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                {t('testingArea.pdfGenerationBody')}
              </div>
            </TestCard>

            <TestCard
              title={t('testingArea.fileUploadTitle')}
              description={t('testingArea.fileUploadDesc')}
              testKey="upload"
              action={async () => {
                const blob = new Blob(['test content'], { type: 'text/plain' });
                const formData = new FormData();
                formData.append('file', blob, 'test.txt');
                formData.append('entity_type', 'test');
                formData.append('entity_id', 'test');
                const res = await fetch('/api/documents/upload', {
                  method: 'POST',
                  headers: { 'X-CSRF-Token': getCsrfToken() || '' },
                  credentials: 'include',
                  body: formData,
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {t('testingArea.fileUploadBody')}
              </div>
            </TestCard>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{t('testingArea.createTestUsersTitle')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('testingArea.createTestUsersBody')}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await runTest('createTestUsers', async () => {
                    const data = await api('/api/testing/create-test-users', { method: 'POST' });
                    if (data.error) throw new Error(data.error);
                    return data;
                  });
                }}
                disabled={loading['createTestUsers']}
              >
                {loading['createTestUsers'] ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                {t('testingArea.createAll')}
              </Button>
            </div>
            {results['createTestUsers'] && (
              <div
                className={`rounded-lg p-3 text-sm font-mono ${results['createTestUsers'].status === 'pass' ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}
              >
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(results['createTestUsers'].data, null, 2)}
                </pre>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {['manager', 'agent', 'accounting'].map((tier) => (
                <Button
                  key={tier}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={async () => {
                    await runTest(`createUser_${tier}`, async () => {
                      const data = await api('/api/testing/create-test-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tier }),
                      });
                      if (data.error) throw new Error(data.error);
                      return data;
                    });
                  }}
                  disabled={loading[`createUser_${tier}`]}
                >
                  {loading[`createUser_${tier}`] ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {t('testingArea.createTierButton', { tier: tier.charAt(0).toUpperCase() + tier.slice(1) })}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{t('testingArea.cleanUpTestUsersTitle')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('testingArea.cleanUpTestUsersBody')}</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await runTest('cleanupTestUsers', async () => {
                    const data = await api('/api/testing/cleanup-test-users', { method: 'POST' });
                    if (data.error) throw new Error(data.error);
                    return data;
                  });
                }}
                disabled={loading['cleanupTestUsers']}
              >
                {loading['cleanupTestUsers'] ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                {t('testingArea.cleanUp')}
              </Button>
            </div>
            {results['cleanupTestUsers'] && (
              <div
                className={`rounded-lg p-3 text-sm font-mono mt-4 ${results['cleanupTestUsers'].status === 'pass' ? 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}
              >
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(results['cleanupTestUsers'].data, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TestCard
              title={t('testingArea.dbHealthTitle')}
              description={t('testingArea.dbHealthDesc')}
              testKey="dbHealth"
              action={async () => {
                const data = await api('/api/testing/db-health');
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="w-4 h-4" />
                {t('testingArea.dbHealthBody')}
              </div>
            </TestCard>

            <TestCard
              title={t('testingArea.apiHealthTitle')}
              description={t('testingArea.apiHealthDesc')}
              testKey="apiHealth"
              action={async () => {
                const endpoints = ['/api/entities', '/api/search?q=', '/api/notifications', '/api/audit/logs'];
                const results = await Promise.all(
                  endpoints.map(async (ep) => {
                    try {
                      const res = await fetch(ep, { credentials: 'include' });
                      return { endpoint: ep, status: res.status, ok: res.ok };
                    } catch (e) {
                      return { endpoint: ep, status: 'error', error: e.message };
                    }
                  }),
                );
                return { endpoints: results };
              }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4" />
                {t('testingArea.apiHealthBody')}
              </div>
            </TestCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
