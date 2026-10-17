export const MAX_BODY_BYTES = 4_000_000; // Under Vercel's 4.5MB serverless request limit

export type SyncKind = 'draws' | 'predictions' | 'model';

export function resolveSyncKind(type: unknown): SyncKind {
  if (type === 'predictions' || type === 'model') return type;
  return 'draws';
}

/** Returns an error message, or null when the payload is valid. */
export function validateSyncPayload(kind: SyncKind, data: unknown): string | null {
  if (kind === 'draws') return validateDraws(data);
  if (kind === 'predictions') return validatePredictions(data);
  return validateModel(data);
}

function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function validateDraws(data: unknown): string | null {
  if (!Array.isArray(data)) return 'data doit être un tableau de tirages.';
  if (data.length > 5000) return 'Trop de tirages (max 5000).';

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (typeof d !== 'object' || d === null) return `Tirage ${i} invalide.`;
    const draw = d as Record<string, unknown>;

    if (typeof draw.date !== 'string' || draw.date.length === 0 || draw.date.length > 64) {
      return `Tirage ${i} : date invalide.`;
    }
    if (typeof draw.time !== 'string' || !/^([01]?\d|2[0-3])h$/.test(draw.time)) {
      return `Tirage ${i} : heure invalide (format 0h-23h attendu).`;
    }
    for (let n = 0; n < 10; n++) {
      if (!isIntInRange(draw[`num${n}`], 1, 25)) return `Tirage ${i} : num${n} invalide (1-25 attendu).`;
    }
    if (typeof draw.letter !== 'string' || !/^[A-Za-z]$/.test(draw.letter)) {
      return `Tirage ${i} : lettre invalide.`;
    }
  }
  return null;
}

function validatePredictions(data: unknown): string | null {
  if (!Array.isArray(data)) return 'data doit être un tableau de prédictions.';
  if (data.length > 500) return 'Trop de prédictions (max 500).';

  for (let i = 0; i < data.length; i++) {
    const p = data[i];
    if (typeof p !== 'object' || p === null) return `Prédiction ${i} invalide.`;
    const pred = p as Record<string, unknown>;

    if (typeof pred.timestamp !== 'string' || pred.timestamp.length === 0) {
      return `Prédiction ${i} : timestamp invalide.`;
    }
    if (!Array.isArray(pred.grilles) || pred.grilles.length > 50) {
      return `Prédiction ${i} : grilles invalides.`;
    }
    for (const g of pred.grilles) {
      if (!Array.isArray(g) || g.length !== 11 || !g.every((x) => typeof x === 'number' && Number.isFinite(x))) {
        return `Prédiction ${i} : grille invalide (11 nombres attendus).`;
      }
    }
  }
  return null;
}

function validateModel(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return 'Modèle invalide (objet attendu).';
  }
  return null;
}
