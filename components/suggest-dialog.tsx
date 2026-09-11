'use client';
// One form for all four kinds of suggestion. Every one of them demands a source URL,
// because a suggestion without one is an opinion and this board does not store those.
import { useState } from 'react';
import { Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Connection, Entity } from '@/lib/intelligence';
export type SuggestMode =
  | { kind: 'attribute'; entity: Entity }
  | { kind: 'connection'; from?: Entity }
  | { kind: 'entity' }
  | { kind: 'source'; connection: Connection };
type Props = {
  token: string;
  mode: SuggestMode | null;
  entities: Entity[];
  columns: string[];
  onClose: () => void;
  onSent: () => void;
};
const titles: Record<SuggestMode['kind'], [string, string]> = {
  attribute: [
    'Suggest an attribute',
    'Add a fact about this entity. It becomes a column if the owner accepts it.',
  ],
  connection: [
    'Suggest a connection',
    'Say what links two entities on this board, and show where that is written down.',
  ],
  entity: [
    'Suggest an entity',
    'Propose something this board is missing.',
  ],
  source: [
    'Add a source',
    'Point at another published account of this connection.',
  ],
};
export function SuggestDialog({
  token,
  mode,
  entities,
  columns,
  onClose,
  onSent,
}: Props) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string) => (event: { target: { value: string } }) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));
  if (!mode) return null;
  const [title, description] = titles[mode.kind];
  async function send(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!mode) return;
    setError('');
    setBusy(true);
    const payload: Record<string, string> =
      mode.kind === 'attribute'
        ? {
            entityId: mode.entity.id,
            key: fields.key ?? '',
            value: fields.value ?? '',
          }
        : mode.kind === 'connection'
          ? {
              from: fields.from ?? mode.from?.id ?? '',
              to: fields.to ?? '',
              label: fields.label ?? '',
              evidence: fields.evidence ?? '',
              date: fields.date ?? '',
              status: fields.status ?? 'Documented',
            }
          : mode.kind === 'entity'
            ? {
                name: fields.name ?? '',
                kind: fields.kind ?? 'Company',
                description: fields.description ?? '',
              }
            : { connectionId: mode.connection.id, note: fields.note ?? '' };
    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          kind: mode.kind,
          targetId:
            mode.kind === 'attribute'
              ? mode.entity.id
              : mode.kind === 'source'
                ? mode.connection.id
                : '',
          payload,
          evidenceUrl,
          message,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error ?? 'The suggestion could not be sent.');
      setFields({});
      setEvidenceUrl('');
      setMessage('');
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="desk-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="desk-form" onSubmit={(event) => void send(event)}>
          {mode.kind === 'attribute' && (
            <>
              <p className="suggest-subject">{mode.entity.name}</p>
              <label>
                Attribute
                <input
                  required
                  list="suggest-columns"
                  maxLength={40}
                  value={fields.key ?? ''}
                  onChange={set('key')}
                  placeholder="e.g. Investor"
                />
                <datalist id="suggest-columns">
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </datalist>
              </label>
              <label>
                Value
                <input
                  required
                  maxLength={200}
                  value={fields.value ?? ''}
                  onChange={set('value')}
                />
              </label>
            </>
          )}
          {mode.kind === 'connection' && (
            <>
              <div className="form-columns">
                <label>
                  From
                  <select
                    required
                    value={fields.from ?? mode.from?.id ?? ''}
                    onChange={set('from')}
                  >
                    <option value="">Choose</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  To
                  <select required value={fields.to ?? ''} onChange={set('to')}>
                    <option value="">Choose</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Relationship
                <input
                  required
                  maxLength={100}
                  value={fields.label ?? ''}
                  onChange={set('label')}
                  placeholder="e.g. co-founded"
                />
              </label>
              <label>
                Evidence
                <textarea
                  required
                  maxLength={1200}
                  value={fields.evidence ?? ''}
                  onChange={set('evidence')}
                  placeholder="What does the source establish?"
                />
              </label>
              <div className="form-columns">
                <label>
                  Source date
                  <input
                    type="date"
                    required
                    value={fields.date ?? ''}
                    onChange={set('date')}
                  />
                </label>
                <label>
                  Evidence type
                  <select
                    value={fields.status ?? 'Documented'}
                    onChange={set('status')}
                  >
                    <option value="Documented">Documented</option>
                    <option value="Hypothesis">Hypothesis</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {mode.kind === 'entity' && (
            <>
              <label>
                Name
                <input
                  required
                  maxLength={100}
                  value={fields.name ?? ''}
                  onChange={set('name')}
                />
              </label>
              <label>
                Category
                <input
                  maxLength={40}
                  value={fields.kind ?? ''}
                  onChange={set('kind')}
                  placeholder="Company"
                />
              </label>
              <label>
                What is it?
                <textarea
                  maxLength={300}
                  value={fields.description ?? ''}
                  onChange={set('description')}
                />
              </label>
            </>
          )}
          {mode.kind === 'source' && (
            <>
              <p className="suggest-subject">{mode.connection.label}</p>
              <label>
                What does this source add?
                <input
                  maxLength={200}
                  value={fields.note ?? ''}
                  onChange={set('note')}
                  placeholder="e.g. names the date the deal closed"
                />
              </label>
            </>
          )}
          <label>
            Source URL
            <input
              type="url"
              required
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Note to the owner <span className="label-hint">optional</span>
            <input
              maxLength={600}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={busy}>
            <Send size={15} />
            {busy ? 'Sending…' : 'Send to the owner'}
          </button>
          <p className="small-note">
            Nothing you send changes the board. It waits in the owner&apos;s
            inbox until they accept it.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
