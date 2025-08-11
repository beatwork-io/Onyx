import { useState } from "react";
export default function BeatForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  async function onSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/beat/create", { method: "POST", body: fd });
    const j = await r.json();
    setResult(j);
    setBusy(false);
  }
  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-4 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-semibold">Nouveau Beat</h1>
      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-1 flex flex-col">Client ID<input name="clientId" className="border p-2 rounded" placeholder="client_cuid" required/></label>
        <label className="col-span-1 flex flex-col">Channel ID<input name="channelId" className="border p-2 rounded" placeholder="UCxxxx" required/></label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col">Beat Name<input name="beatName" className="border p-2 rounded" placeholder="Lotus"/></label>
        <label className="flex flex-col">Primary Type<input name="primaryType" className="border p-2 rounded" placeholder="DaBaby type beat"/></label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col">Audio MP3<input name="audio" type="file" accept="audio/mpeg" className="border p-2 rounded" required/></label>
        <label className="flex flex-col">Cover (jpg/png)<input name="cover" type="file" accept="image/*" className="border p-2 rounded"/></label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" name="autoSlot" defaultChecked/> Auto-slot (18:00)</label>
        <label className="flex flex-col">PublishAt (optionnel)<input name="publishAt" type="datetime-local" className="border p-2 rounded"/></label>
      </div>
      <button disabled={busy} className="px-4 py-2 rounded-xl border shadow">{busy ? "Traitement..." : "Créer & planifier"}</button>
      {result && (<pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>)}
    </form>
  );
}
