export type SplashTimeOfDay = 'morning' | 'day' | 'evening';

export type SplashMood = {
  period: SplashTimeOfDay;
  greeting: string;
  formula: string;
  auraOuter: string;
  auraMid: string;
  orbitColor: string;
};

const MORNING_GREETINGS = ['Bună dimineața!', 'Start proaspăt!', 'Gata de 10?'] as const;
const DAY_GREETINGS = ['Salut!', 'Hai la tablă!', 'Gata de mate?'] as const;
const EVENING_GREETINGS = ['Spor la teme!', 'Seară de 10!', 'Hai să rezolvăm!'] as const;

const STUDIO_FORMULAS = [
  'a² + b² = c²',
  'Δ = b² − 4ac',
  '(a + b)² = a² + 2ab + b²',
  'A = π · r²',
  'sin²x + cos²x = 1',
  'a² − b² = (a − b)(a + b)',
] as const;

function pickItem<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(Math.floor(seed)) % items.length;
  return items[index];
}

/**
 * Selects a fresh, time-aware studio atmosphere, friendly greeting, and iconic
 * math formula spark for each app launch while preserving the warm cream canvas.
 */
export function resolveSplashMood(hour: number, seed: number): SplashMood {
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
  const formula = pickItem(STUDIO_FORMULAS, seed);

  if (normalizedHour >= 6 && normalizedHour < 12) {
    return {
      period: 'morning',
      greeting: pickItem(MORNING_GREETINGS, seed),
      formula,
      auraOuter: 'rgba(255, 212, 71, 0.16)',
      auraMid: 'rgba(216, 255, 62, 0.25)',
      orbitColor: 'rgba(124, 60, 255, 0.2)',
    };
  }

  if (normalizedHour >= 12 && normalizedHour < 18) {
    return {
      period: 'day',
      greeting: pickItem(DAY_GREETINGS, seed),
      formula,
      auraOuter: 'rgba(124, 60, 255, 0.095)',
      auraMid: 'rgba(67, 214, 230, 0.2)',
      orbitColor: 'rgba(124, 60, 255, 0.22)',
    };
  }

  return {
    period: 'evening',
    greeting: pickItem(EVENING_GREETINGS, seed),
    formula,
    auraOuter: 'rgba(124, 60, 255, 0.125)',
    auraMid: 'rgba(255, 141, 107, 0.17)',
    orbitColor: 'rgba(124, 60, 255, 0.24)',
  };
}
