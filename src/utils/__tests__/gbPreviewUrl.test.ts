import { describe, it, expect } from 'vitest';
import { getGbPreviewUrl, gbImageUrl } from '../gbPreviewUrl';

/**
 * GameBanana puts preview images in several places depending on the endpoint.
 * This helper replaced five hand-written copies of the same expression, one of
 * which had drifted (the Discover carousel checked `screenshot` before
 * `screenshots[0]`), so the same mod could show different images in different
 * places. These pin one rule for all of them.
 */
const base = 'https://images.gamebanana.com/img/ss/mods';

describe('getGbPreviewUrl', () => {
  it('prefers the first entry of screenshots over the single screenshot field', () => {
    const url = getGbPreviewUrl({
      _aPreviewContent: {
        screenshots: [{ _sBaseUrl: base, _sFile800: 'first.jpg' }],
        screenshot: { _sBaseUrl: base, _sFile800: 'subfeed.jpg' },
      },
    });
    expect(url).toBe(`${base}/first.jpg`);
  });

  it('falls back through the known shapes in order', () => {
    expect(
      getGbPreviewUrl({ _aPreviewContent: { screenshot: { _sBaseUrl: base, _sFile: 'a.jpg' } } })
    ).toBe(`${base}/a.jpg`);
    expect(
      getGbPreviewUrl({ _aPreviewMedia: { _aImages: [{ _sBaseUrl: base, _sFile530: 'b.jpg' }] } })
    ).toBe(`${base}/b.jpg`);
    expect(getGbPreviewUrl({ _sImageUrl: `${base}/c.jpg` })).toBe(`${base}/c.jpg`);
    expect(getGbPreviewUrl({ _sThumbnailUrl: `${base}/d.jpg` })).toBe(`${base}/d.jpg`);
  });

  it('picks the largest size a record offers', () => {
    expect(
      gbImageUrl({ _sBaseUrl: base, _sFile220: 's.jpg', _sFile530: 'm.jpg', _sFile800: 'l.jpg' })
    ).toBe(`${base}/l.jpg`);
    expect(gbImageUrl({ _sBaseUrl: base, _sFile220: 's.jpg' })).toBe(`${base}/s.jpg`);
  });

  it('returns null when there is no usable image', () => {
    expect(getGbPreviewUrl(null)).toBeNull();
    expect(getGbPreviewUrl({})).toBeNull();
    expect(getGbPreviewUrl({ _aPreviewContent: { screenshots: [] } })).toBeNull();
    expect(gbImageUrl({ _sBaseUrl: base })).toBeNull();
  });

  it('rejects anything that is not https', () => {
    expect(getGbPreviewUrl({ _sImageUrl: 'http://gamebanana.com/x.jpg' })).toBeNull();
    expect(getGbPreviewUrl({ _sImageUrl: 'javascript:alert(1)' })).toBeNull();
    expect(getGbPreviewUrl({ _sImageUrl: 'data:image/png;base64,AAAA' })).toBeNull();
    expect(gbImageUrl({ _sBaseUrl: 'javascript:alert(1)//', _sFile800: 'x.jpg' })).toBeNull();
  });
});
