import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { GBCarousel } from '../gamebanana';

describe('GBCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockMod1 = {
    _idRow: 101,
    _sName: 'Mod 1 SFW',
    _bIsNsfw: false,
    _aPreviewContent: {
      screenshot: { _sBaseUrl: 'https://images.gb.com', _sFile: 'img1.png' },
    },
    _aSubmitter: { _sName: 'Author 1' },
  };

  const mockMod2 = {
    _idRow: 102,
    _sName: 'Mod 2 NSFW',
    _bIsNsfw: true,
    _aPreviewContent: {
      screenshot: { _sBaseUrl: 'https://images.gb.com', _sFile: 'img2.png' },
    },
    _aSubmitter: { _sName: 'Author 2' },
  };

  const mockMod3 = {
    _idRow: 103,
    _sName: 'Mod 3 NSFW',
    _bIsNsfw: true,
    _aPreviewContent: {
      screenshot: { _sBaseUrl: 'https://images.gb.com', _sFile: 'img3.png' },
    },
    _aSubmitter: { _sName: 'Author 3' },
  };

  it('does not throw TypeError when mods array shrinks due to NSFW filtering while currentIndex > 0', () => {
    // Initial render with 3 mods
    const { rerender } = render(<GBCarousel mods={[mockMod1, mockMod2, mockMod3]} />);

    // Advance timer by 5000ms to advance currentIndex from 0 to 1, then another 5000ms to advance to 2
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // NSFW filter enabled: array shrinks from 3 mods to 1 mod ([mockMod1])
    // Previously, currentIndex remained at 2, so mods[2] was undefined, throwing:
    // TypeError: Cannot read properties of undefined (reading '_aPreviewContent')
    expect(() => {
      rerender(<GBCarousel mods={[mockMod1]} />);
    }).not.toThrow();
  });

  it('safely handles empty or undefined items without crashing', () => {
    expect(() => {
      render(<GBCarousel mods={[]} />);
    }).not.toThrow();

    expect(() => {
      render(<GBCarousel mods={[undefined]} />);
    }).not.toThrow();
  });
});
