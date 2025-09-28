export function getEnv(key) {
  // Vite exposes variables prefixed with VITE_
  // Return undefined instead of empty strings.
  const v = import.meta?.env?.[key];
  return (typeof v === 'string' && v.trim().length > 0) ? v.trim() : undefined;
}