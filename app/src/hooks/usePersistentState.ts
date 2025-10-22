import { useState, useEffect } from 'react';

/**
 * Custom hook that persists state across component re-mounts
 * Uses a global store to maintain state even when components are unmounted/remounted
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalStore = new Map<string, any>();

export function usePersistentState<T>(
  key: string, 
  initialValue: T
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    return globalStore.get(key) ?? initialValue;
  });
  
  const setPersistentState = (value: T) => {
    globalStore.set(key, value);
    setState(value);
  };
  
  // Listen for changes from other instances
  useEffect(() => {
    const handleStorageChange = () => {
      const storedValue = globalStore.get(key);
      if (storedValue !== undefined && storedValue !== state) {
        setState(storedValue);
      }
    };
    
    // Check for changes less frequently to reduce CPU usage (500ms instead of 50ms)
    const interval = setInterval(handleStorageChange, 500);
    
    return () => clearInterval(interval);
  }, [key, state]);
  
  return [state, setPersistentState];
}
