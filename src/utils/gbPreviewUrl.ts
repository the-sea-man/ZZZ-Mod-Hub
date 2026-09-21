/**
 * The subset of a GameBanana v13 mod record that carries preview images.
 *
 * GameBanana returns previews in different places depending on the endpoint
 * (Mod/Multi and ProfilePage use `_aPreviewContent.screenshots`, the subfeed
 * uses `_aPreviewContent.screenshot`, older records use `_aPreviewMedia`).
 */
export interface GbImageRef {
  _sBaseUrl?: string;
  _sFile800?: string;
  _sFile530?: string;
  _sFile?: string;
  _sFile220?: string;
}

export interface GbPreviewSource {
  _idRow?: number;
  _aPreviewContent?: {
    screenshots?: GbImageRef[];
    screenshot?: GbImageRef;
  };
  _aPreviewMedia?: {
    _aImages?: GbImageRef[];
  };
  _sImageUrl?: string;
  _sThumbnailUrl?: string;
}

/**
 * URL for one GameBanana image reference at the largest size it offers, or
 * `null` if it is incomplete or not https. Used directly by the screenshot
 * gallery, and by `getGbPreviewUrl` for the first image.
 */
export function gbImageUrl(ref: GbImageRef | undefined): string | null {
  return httpsOnly(fromRef(ref));
}

function fromRef(ref: GbImageRef | undefined): string | null {
  if (!ref?._sBaseUrl) return null;
  const file = ref._sFile800 || ref._sFile530 || ref._sFile || ref._sFile220;
  return file ? `${ref._sBaseUrl}/${file}` : null;
}

/** Only https images render under the app's CSP; anything else is rejected. */
function httpsOnly(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * The first GameBanana preview image for a mod record, at the largest size the
 * record offers, or `null` when there is none.
 *
 * This is the single place that knows GameBanana's image shapes. The Discover
 * card, the download-time cache seed and the library fallback all call it, so a
 * change to GameBanana's response format is fixed once.
 */
export function getGbPreviewUrl(item: GbPreviewSource | null | undefined): string | null {
  if (!item) return null;
  const candidate =
    fromRef(item._aPreviewContent?.screenshots?.[0]) ??
    fromRef(item._aPreviewContent?.screenshot) ??
    fromRef(item._aPreviewMedia?._aImages?.[0]) ??
    item._sImageUrl ??
    item._sThumbnailUrl ??
    null;
  return httpsOnly(candidate);
}
