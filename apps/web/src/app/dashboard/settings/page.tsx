'use client';

import { useState } from 'react';
import { Copy, Check, RefreshCw, Radio, ExternalLink } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useOrg, useWebhookStatus } from '@/hooks/useOrgData';
import { useLoadWebhookSecretMutation, useRegenerateWebhookSecretMutation } from '@/hooks/useMutations';
import { toast } from 'sonner';
import env from '@/config/env';
import { formatRelativeTime } from '@/lib/utils';

function buildWebhookUrl(orgId: string | null | undefined): string {
  const base = env.webhookUrl || 'http://localhost:4000/webhooks/github';
  if (!orgId) return base;
  const url = new URL(base);
  url.searchParams.set('orgId', orgId);
  return url.toString();
}

export default function SettingsPage() {
  const { data: me, isLoading } = useOrg();
  const orgId = me?.currentOrgId;
  const webhookUrl = buildWebhookUrl(orgId);
  const { data: webhookStatus, isLoading: statusLoading, isError: statusError } = useWebhookStatus(orgId);
  const loadSecretMutation = useLoadWebhookSecretMutation(orgId);
  const regenerateMutation = useRegenerateWebhookSecretMutation(orgId);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadSecret() {
    const result = await loadSecretMutation.mutateAsync();
    setSecret(result.webhookSecret);
  }

  async function handleRegenerate() {
    const result = await regenerateMutation.mutateAsync();
    setSecret(result.webhookSecret);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isLoading || !me || !orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardLayout orgs={me.orgs} currentOrgId={orgId}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Configure GitHub webhook integration</p>
        </div>

        {statusError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load webhook status.
          </div>
        )}

        {statusLoading ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-surface-border bg-white p-6 shadow-sm">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
            <div className="rounded-xl border border-surface-border bg-white p-6 shadow-sm">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              <div className="mt-4 h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="mt-3 h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ) : (
          <>
        <div className="rounded-xl border border-surface-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Webhook Status</h3>
            <div className="flex items-center gap-2">
              <Radio
                className={`h-4 w-4 ${webhookStatus?.lastEventAt ? 'text-emerald-500' : 'text-amber-500'}`}
              />
              <span className="text-xs font-medium text-slate-600">
                {webhookStatus?.lastEventAt
                  ? `Last event ${formatRelativeTime(webhookStatus.lastEventAt)}`
                  : 'Listening...'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">GitHub Webhook Setup</h3>
          <p className="mt-1 text-xs text-slate-500">
            Follow these steps to connect your GitHub organization
          </p>

          <ol className="mt-4 space-y-4">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                1
              </span>
              <div>
                <p className="text-sm text-slate-700">
                  Go to GitHub Org Settings → Webhooks → Add webhook
                </p>
                <a
                  href="https://github.com/settings/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  Open GitHub Developer Settings <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-1 text-xs text-slate-400">
                  For org webhooks: GitHub org → Settings → Webhooks → Add webhook
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                2
              </span>
              <div className="flex-1">
                <p className="text-sm text-slate-700">Paste the Payload URL:</p>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <code className="flex-1 truncate text-xs text-slate-800">{webhookUrl}</code>
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'URL')}
                    className="shrink-0 rounded p-1 hover:bg-slate-200"
                  >
                    {copied === 'URL' ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                3
              </span>
              <div className="flex-1">
                <p className="text-sm text-slate-700">Paste the Secret:</p>
                {!secret ? (
                  <button
                    onClick={loadSecret}
                    className="mt-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Reveal Webhook Secret
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <code className="flex-1 truncate text-xs text-slate-800">{secret}</code>
                    <button
                      onClick={() => copyToClipboard(secret, 'Secret')}
                      className="shrink-0 rounded p-1 hover:bg-slate-200"
                    >
                      {copied === 'Secret' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerateMutation.isPending}
                      className="shrink-0 rounded p-1 hover:bg-slate-200"
                      title="Regenerate secret"
                    >
                      <RefreshCw
                        className={`h-4 w-4 text-slate-400 ${regenerateMutation.isPending ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                4
              </span>
              <div>
                <p className="text-sm text-slate-700">Select these events:</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {['Push', 'Pull requests', 'Pull request reviews', 'Issues'].map((event) => (
                    <span
                      key={event}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          </ol>
        </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
