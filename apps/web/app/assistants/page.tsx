'use client';

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import type { Assistant } from '@ai-life-os/contracts';

const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AssistantsPage() {
  const { data, mutate } = useSWR<{ assistants: Assistant[] }>(
    `/api/assistants?userId=${PHASE1_USER_ID}`,
    fetcher
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assistant? All conversations will be deleted.')) {
      return;
    }

    await fetch(`/api/assistants/${id}`, { method: 'DELETE' });
    mutate();
  };

  const assistants = data?.assistants ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-muted-foreground">{assistants.length} assistants</p>
        <Link
          href="/assistants/new"
          className="rounded-lg bg-secondary px-4 py-2 text-secondary-foreground hover:bg-accent"
        >
          Create Assistant
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {assistants.map((assistant) => (
          <div
            key={assistant.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="mb-2 flex items-start justify-between">
              <h2 className="text-lg font-medium text-foreground">
                {assistant.name}
              </h2>
              <span
                className={`rounded px-2 py-1 text-xs ${
                  assistant.status === 'active'
                    ? 'bg-green-900 text-green-200'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {assistant.status}
              </span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              {assistant.description || 'No description'}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Model: {assistant.model} | Temp: {assistant.temperature}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/assistants/${assistant.id}`}
                className="rounded bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-accent"
              >
                Edit
              </Link>
              <button
                onClick={() => handleDelete(assistant.id)}
                className="rounded bg-destructive px-3 py-1 text-sm text-destructive-foreground hover:bg-destructive/80"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
