function isNonNullArray<T>(array: Array<T | null>): array is T[] {
  return array.every((item) => item !== null);
}

export { isNonNullArray };
