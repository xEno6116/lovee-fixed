export function nextMemoryIndex(currentIndex: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return (currentIndex + 1) % itemCount;
}

export function isReleasedAt(date: string, now = Date.now()) {
  return !date || new Date(date).getTime() <= now;
}
