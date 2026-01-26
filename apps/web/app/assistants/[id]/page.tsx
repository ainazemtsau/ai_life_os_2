'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import useSWR from 'swr';
import type { Assistant } from '@ai-life-os/contracts';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EditAssistantPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data, error: loadError } = useSWR<{ assistant: Assistant }>(
    `/api/assistants/${id}`,
    fetcher
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [temperature, setTemperature] = React.useState(0.7);

  const assistant = data?.assistant;

  React.useEffect(() => {
    if (assistant) {
      setTemperature(assistant.temperature);
    }
  }, [assistant]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const updateData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      systemPrompt: formData.get('systemPrompt') as string || undefined,
      model: formData.get('model') as string,
      temperature: parseFloat(formData.get('temperature') as string),
      maxTokens: formData.get('maxTokens')
        ? parseInt(formData.get('maxTokens') as string, 10)
        : undefined,
      status: formData.get('status') as 'active' | 'inactive',
    };

    try {
      const response = await fetch(`/api/assistants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update assistant');
      }

      router.push('/assistants');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) return <div className="text-red-400">Failed to load assistant</div>;
  if (!assistant) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Edit Assistant</h2>

      {error && (
        <div className="rounded bg-red-900/50 p-3 text-red-200">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Name *</label>
        <input
          name="name"
          required
          defaultValue={assistant.name}
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Description</label>
        <input
          name="description"
          defaultValue={assistant.description}
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">System Prompt</label>
        <textarea
          name="systemPrompt"
          rows={4}
          defaultValue={assistant.systemPrompt}
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Model</label>
          <select
            name="model"
            defaultValue={assistant.model}
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          >
            <option value="gpt-5-mini">gpt-5-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Temperature ({temperature})
          </label>
          <input
            name="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Max Tokens</label>
          <input
            name="maxTokens"
            type="number"
            min="1"
            defaultValue={assistant.maxTokens}
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue={assistant.status}
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-secondary px-6 py-2 text-white hover:bg-accent text-secondary-foreground disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
