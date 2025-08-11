import { addDays, setHours, setMinutes, setSeconds, isSameDay } from 'date-fns';

/**
 * Retourne le prochain créneau dispo (date à H:00) qui n'est pas dans la liste des dates déjà prises.
 * On compare par jour (pas par heure) pour rester simple.
 */
export function nextAvailableSlot(takenDates: Date[], hour = 18): Date {
  const takenDays = new Set(takenDates.map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()));
  let d = new Date();
  d = setSeconds(setMinutes(setHours(d, hour), 0), 0);

  // Si aujourd'hui est déjà pris, on décale au lendemain, etc.
  for (let i = 0; i < 365; i++) {
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (!takenDays.has(key)) return d;
    d = addDays(d, 1);
    d = setSeconds(setMinutes(setHours(d, hour), 0), 0);
  }
  return d;
}
