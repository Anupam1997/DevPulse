'use client';

import { useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { BurndownChart } from '@/components/BurndownChart';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useOrg, useSprintsQuery, useSprintDetail } from '@/hooks/useOrgData';
import { useCreateSprintMutation } from '@/hooks/useMutations';

export default function SprintsPage() {
  const { data: me, isLoading: meLoading, error: meError } = useOrg();
  const orgId = me?.currentOrgId;
  const createSprint = useCreateSprintMutation(orgId);
  const [showForm, setShowForm] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    goalPoints: 100,
  });

  const {
    data: sprints,
    isLoading: sprintsLoading,
    error: sprintsError,
  } = useSprintsQuery(orgId);

  useEffect(() => {
    if (sprints && sprints.length > 0 && !selectedSprintId) {
      setSelectedSprintId(sprints[0].id);
    }
  }, [sprints, selectedSprintId]);

  const {
    data: sprintDetail,
    isLoading: detailLoading,
    error: detailError,
  } = useSprintDetail(orgId, selectedSprintId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    await createSprint.mutateAsync({
      name: form.name,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      goalPoints: form.goalPoints,
    });
    setShowForm(false);
  }

  if (meLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (meError || !me || !orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Could not load your organization. Try signing in again.</span>
        </div>
      </div>
    );
  }

  const chartLoading = sprintsLoading || (selectedSprintId && detailLoading);
  const chartError = sprintsError || detailError;

  return (
    <DashboardLayout orgs={me.orgs} currentOrgId={orgId}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sprints</h1>
            <p className="text-sm text-slate-500">Manage sprints and track burndown</p>
          </div>
          <div className="flex items-center gap-3">
            {sprints && sprints.length > 1 && (
              <select
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-slate-700"
              >
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              New Sprint
            </button>
          </div>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-surface-border bg-white p-6 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-900">Create Sprint</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  placeholder="Sprint 24"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Goal Points</label>
                <input
                  type="number"
                  value={form.goalPoints}
                  onChange={(e) => setForm({ ...form, goalPoints: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  min={0}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={createSprint.isPending}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createSprint.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {chartError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Failed to load sprint data. Please try again.</span>
          </div>
        )}

        {chartLoading ? (
          <div className="flex h-[320px] items-center justify-center rounded-xl border border-surface-border bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : (
          <ErrorBoundary>
            <BurndownChart
              data={sprintDetail?.burndown ?? []}
              sprintName={sprintDetail?.name}
            />
          </ErrorBoundary>
        )}

        {!chartLoading && !chartError && sprints && sprints.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            No sprints yet. Create your first sprint to start tracking burndown.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
