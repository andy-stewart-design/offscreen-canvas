// Utility functions for smooth animations
const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor;
};

// Easing functions
const easeOutCubic = (x: number): number => {
  return 1 - Math.pow(1 - x, 3);
};

const easeOutQuart = (x: number): number => {
  return 1 - Math.pow(1 - x, 4);
};

export { lerp, easeOutCubic, easeOutQuart };
