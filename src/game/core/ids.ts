/** Monotonic `prefix_n` id generator, resettable between matches. */
export type IdSource = {
  next: (prefix: string) => string;
  reset: () => void;
};

export function createIdSource(): IdSource {
  let n = 0;
  return {
    next: (prefix) => `${prefix}_${++n}`,
    reset: () => {
      n = 0;
    },
  };
}
