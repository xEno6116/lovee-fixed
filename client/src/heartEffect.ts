export type FloatingHeartSeed = { id: string; x: number; y: number };
export type FloatingHeart = FloatingHeartSeed & { size: number; drift: number };

export function createFloatingHeart(seed: FloatingHeartSeed, random = Math.random): FloatingHeart {
  return { ...seed, size: 21 + Math.round(random() * 14), drift: -35 + Math.round(random() * 70) };
}
