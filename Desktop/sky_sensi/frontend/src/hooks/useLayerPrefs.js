import * as React from 'react';

export function useLayerPrefs(initial) {
  const key = 'falconLayerPrefs';

  const load = React.useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
      console.warn('Failed to load layer preferences:', error);
      return {};
    }
  }, [key]);

  const [prefs, setPrefs] = React.useState(() => ({ ...initial, ...load() }));

  // Debounced save to localStorage to prevent excessive writes
  const saveTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(prefs));
      } catch (error) {
        console.error('Failed to save layer preferences:', error);
        // Handle quota exceeded or other localStorage errors
        if (error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded. Clearing old preferences.');
          try {
            localStorage.removeItem(key);
            localStorage.setItem(key, JSON.stringify(initial));
          } catch (clearError) {
            console.error('Failed to clear preferences:', clearError);
          }
        }
      }
    }, 100); // 100ms debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [prefs, key, initial]);

  const setOn = React.useCallback((k, on) => {
    if (typeof k !== 'string') return;
    setPrefs(p => ({ ...p, [k]: { ...(p[k] || {}), on: Boolean(on) } }));
  }, []);

  const setOpacity = React.useCallback((k, opacity) => {
    if (typeof k !== 'string') return;
    const clampedOpacity = Math.min(1, Math.max(0, Number(opacity) || 0));
    setPrefs(p => ({ ...p, [k]: { ...(p[k] || {}), opacity: clampedOpacity } }));
  }, []);

  const reset = React.useCallback(() => {
    setPrefs({ ...initial });
  }, [initial]);

  return { prefs, setOn, setOpacity, reset };
}