type Vars = { PrimaryType: string; BeatName: string; BPM?: number|null; Key?: string|null; BeatStarsURL?: string|null; Email?: string|null; LicensingText?: string|null; Hashtags?: string[]; };
export function defaultTitle(v: Vars){ const bpm=v.BPM?` | BPM ${Math.round(v.BPM)}`:''; const key=v.Key?` | Key ${v.Key}`:''; return `${v.PrimaryType} – ${v.BeatName}${bpm}${key}`.slice(0,95); }
export function defaultDescription(v: Vars){
  const lines=[`Type beat ${v.PrimaryType}.`, v.BeatStarsURL?`🎧 BeatStars : ${v.BeatStarsURL}`:undefined, `BPM : ${v.BPM ?? "?"} — Key : ${v.Key ?? "?"}`, `Licensing: ${v.LicensingText ?? "Contact for licensing."}`, `Contact: ${v.Email ?? ""}`].filter(Boolean);
  const tags=(v.Hashtags ?? ["typebeat"]).map(t=>`#${t}`).join(" ");
  return `${lines.join("\n")}\n\n${tags}`;
}
