import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { playKonamiSound } from '../utils/audio';

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export function useKonamiCode() {
  const bufferRef = useRef<string[]>([]);
  const { incrementStat, showToast } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside text fields
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const expectedIndex = bufferRef.current.length;
      const expectedKey = KONAMI_SEQUENCE[expectedIndex];

      if (key.toLowerCase() === expectedKey.toLowerCase()) {
        bufferRef.current.push(key);
        if (bufferRef.current.length === KONAMI_SEQUENCE.length) {
          bufferRef.current = [];
          incrementStat('konamiCodeEntered');
          playKonamiSound();
          showToast('Secret Unlocked: Retro Gamer (Konami Code)!');
        }
      } else {
        // Check if current key matches starting key 'ArrowUp'
        if (key.toLowerCase() === KONAMI_SEQUENCE[0].toLowerCase()) {
          bufferRef.current = [key];
        } else {
          bufferRef.current = [];
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incrementStat, showToast]);
}
