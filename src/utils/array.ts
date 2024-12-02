export function createArray<T>(item: T, length: number) {
  return Array.from({ length })
    .map(() => item)
    .flat();
}
