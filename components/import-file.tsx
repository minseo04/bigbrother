'use client';
import {useRef, useState} from 'react';
import {Upload} from 'lucide-react';
import {planImport, readImportFiles} from '@/lib/import-file';

type Result = {
  boardId: string;
  name: string;
  created: number;
  reused: number;
  placed: number;
  connections: number;
  truncated: number;
};

type Props = {
  disabled?: boolean;
  className?: string;
  onImported: (result: Result) => Promise<void> | void;
  onError: (message: string) => void;
};

export function ImportFile({disabled, className, onImported, onError}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(list: FileList | File[] | null) {
    const files = [...(list ?? [])].filter((file) => file.size > 0);
    if (!files.length || busy || disabled) return;
    setBusy(true);
    try {
      const payload = await readImportFiles(files);
      planImport(payload.name, payload.nodes, payload.edges);
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {error?: string} & Partial<Result>;
      if (!response.ok || !data.boardId) throw new Error(data.error ?? 'The file could not be imported.');
      await onImported(data as Result);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The file could not be imported.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".csv,.tsv,.txt,.json,text/csv,application/json"
        onChange={(event) => void upload(event.target.files)}
      />
      <button
        type="button"
        className={className}
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        title="Upload a CSV or JSON table. Each row becomes a node on a new board."
      >
        <Upload size={14} />
        {busy ? 'Importing…' : 'Upload table'}
      </button>
    </>
  );
}
