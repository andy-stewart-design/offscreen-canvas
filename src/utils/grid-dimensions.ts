function getGridDimensions(n: number) {
  const grid = Math.floor(Math.sqrt(n));

  if (grid * (grid + 1) <= n) {
    return [grid + 1, grid] as const;
  } else {
    return [grid, grid] as const;
  }
}

export { getGridDimensions };
