import { useState } from 'react';

export default function BeatForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/beat/create', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Upload failed');
      setResult(j);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-4 p-6 border rounded-2xl shadow bg-white/50">
      <h1 className="text-2xl font-semibold">Nouveau Beat</h1>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">User ID</span>
          <input name="userId" required className="border rounded px-3 py-2" placeholder="user_123" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Titre</span>
          <input name="title" required className="border rounded px-3 py-2" placeholder="Travis Scott Type Beat" />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm">Description</span>
          <textarea name="description" rows={4} className="border rounded px-3 py-2" placeholder="Mood, BPM, keywords..." />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Audio (MP3)</span>
          <input type="file" name="audio" accept="audio/mpeg,audio/mp3" required className="border rounded px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm">Cover (PNG/JPG)</span>
          <input type="file" name="cover" accept="image/png,image/jpeg" className="border rounded px-3 py-2" />
        </label>
      </div>
      <button disabled={busy} className="px-4 py-2 rounded-xl border shadow-sm disabled:opacity-50">
        {busy ? 'Upload...' : 'Créer et uploader'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && <pre className="text-xs bg-black text-white p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </form>
  );
}
