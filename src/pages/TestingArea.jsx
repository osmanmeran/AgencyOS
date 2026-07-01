import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Loader2, Mail, FileText, Bell, Upload, Shield, RefreshCw, Database, Plus, Trash2 } from 'lucide-react';

function getToken() {
  try { const s = localStorage.getItem('b44_user'); return s ? JSON.parse(s).token : null; } catch { return null; }
}

async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
  });
  return res.json();
}

export default function TestingArea() {
  const { user } = useAuth();
  const [results, setResults] = useState(/** @type {any} */ ({}));
  const [loading, setLoading] = useState(/** @type {any} */ ({}));

  const addResult = (key, data) => {
    const status = data?.error ? 'fail' : 'pass';
    setResults(prev => ({ ...prev, [key]: { status, data, timestamp: new Date().toLocaleTimeString() } }));
  };

  const runTest = async (key, fn) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const data = await fn();
      addResult(key, data);
    } catch (err) {
      addResult(key, { error: err.message });
    }
    setLoading(prev => ({ ...prev, [key]: false }));
  };

  if (!user || (user.user_tier !== 'admin' && user.role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600">Admin Access Required</h2>
        <p className="text-slate-400 mt-2">This area is restricted to administrators.</p>
      </div>
    );
  }

  const TestCard = ({ title, description, children, testKey, action }) => (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
        </div>
        {action && (
          <Button size="sm" variant="outline" onClick={() => runTest(testKey, action)} disabled={loading[testKey]}>
            {loading[testKey] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Run
          </Button>
        )}
      </div>
      {children}
      {results[testKey] && (
        <div className={`rounded-lg p-3 text-sm font-mono ${results[testKey].status === 'pass' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <div className="flex items-center gap-1 mb-1">
            {results[testKey].status === 'pass' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">{results[testKey].status === 'pass' ? 'OK' : 'FAIL'}</span>
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
        <div className="bg-amber-100 p-2.5 rounded-xl">
          <Shield className="w-6 h-6 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Testing Area</h1>
          <p className="text-sm text-slate-500">Admin-only tools for testing and verifying system features</p>
        </div>
      </div>

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">Feature Tests</TabsTrigger>
          <TabsTrigger value="users">Test Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TestCard
              title="Email Service"
              description="Send a test email to verify SMTP configuration"
              testKey="email"
              action={async () => {
                const data = await api('/api/email/test', { method: 'POST' });
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4" />
                Sends a test email using the configured SMTP provider
              </div>
            </TestCard>

            <TestCard
              title="PDF Generation"
              description="Generate a test PDF document"
              testKey="pdf"
              action={async () => {
                const data = await api('/api/pdf/test', { method: 'POST' });
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText className="w-4 h-4" />
                Generates a sample proposal PDF
              </div>
            </TestCard>

            <TestCard
              title="Notifications"
              description="Send a test notification to your account"
              testKey="notification"
              action={async () => {
                const data = await api('/api/notifications/test', { method: 'POST' });
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Bell className="w-4 h-4" />
                Creates a test notification for the current user
              </div>
            </TestCard>

            <TestCard
              title="File Upload"
              description="Upload a test document to verify file handling"
              testKey="upload"
              action={async () => {
                const blob = new Blob(['test content'], { type: 'text/plain' });
                const formData = new FormData();
                formData.append('file', blob, 'test.txt');
                formData.append('entity_type', 'test');
                formData.append('entity_id', 'test');
                const token = getToken();
                const res = await fetch('/api/documents/upload', {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  body: formData,
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Upload className="w-4 h-4" />
                Uploads a small test file and returns the document record
              </div>
            </TestCard>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Create Test Users</h3>
                <p className="text-sm text-slate-500 mt-1">Provision temporary users for each tier to test permission boundaries</p>
              </div>
              <Button size="sm" variant="outline" onClick={async () => {
                await runTest('createTestUsers', async () => {
                  const data = await api('/api/testing/create-test-users', { method: 'POST' });
                  if (data.error) throw new Error(data.error);
                  return data;
                });
              }} disabled={loading['createTestUsers']}>
                {loading['createTestUsers'] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create All
              </Button>
            </div>
            {results['createTestUsers'] && (
              <div className={`rounded-lg p-3 text-sm font-mono ${results['createTestUsers'].status === 'pass' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(results['createTestUsers'].data, null, 2)}</pre>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {['manager', 'agent', 'accounting'].map(tier => (
                <Button key={tier} variant="outline" size="sm" className="justify-start" onClick={async () => {
                  await runTest(`createUser_${tier}`, async () => {
                    const data = await api('/api/testing/create-test-user', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tier }),
                    });
                    if (data.error) throw new Error(data.error);
                    return data;
                  });
                }} disabled={loading[`createUser_${tier}`]}>
                  {loading[`createUser_${tier}`] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">Clean Up Test Users</h3>
                <p className="text-sm text-slate-500 mt-1">Remove all test users created in the testing area</p>
              </div>
              <Button size="sm" variant="destructive" onClick={async () => {
                await runTest('cleanupTestUsers', async () => {
                  const data = await api('/api/testing/cleanup-test-users', { method: 'POST' });
                  if (data.error) throw new Error(data.error);
                  return data;
                });
              }} disabled={loading['cleanupTestUsers']}>
                {loading['cleanupTestUsers'] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Clean Up
              </Button>
            </div>
            {results['cleanupTestUsers'] && (
              <div className={`rounded-lg p-3 text-sm font-mono mt-4 ${results['cleanupTestUsers'].status === 'pass' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(results['cleanupTestUsers'].data, null, 2)}</pre>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TestCard
              title="Database Health"
              description="Check database connection and migration status"
              testKey="dbHealth"
              action={async () => {
                const data = await api('/api/testing/db-health');
                if (data.error) throw new Error(data.error);
                return data;
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Database className="w-4 h-4" />
                Verifies DB connectivity and applied migrations
              </div>
            </TestCard>

            <TestCard
              title="API Health"
              description="Check all API endpoints are reachable"
              testKey="apiHealth"
              action={async () => {
                const endpoints = ['/api/entities', '/api/search?q=', '/api/notifications', '/api/audit/logs'];
                const results = await Promise.all(endpoints.map(async ep => {
                  try {
                    const res = await fetch(ep, { headers: { Authorization: `Bearer ${getToken()}` } });
                    return { endpoint: ep, status: res.status, ok: res.ok };
                  } catch (e) {
                    return { endpoint: ep, status: 'error', error: e.message };
                  }
                }));
                return { endpoints: results };
              }}
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <RefreshCw className="w-4 h-4" />
                Pings key API routes to verify they respond
              </div>
            </TestCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
