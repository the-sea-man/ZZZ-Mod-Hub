import DOMPurify from 'dompurify';

/**
 * Forces every surviving anchor to be inert-by-default.
 *
 * Remote HTML (GameBanana descriptions and changelogs) and user-supplied
 * language packs can contain links. Inside a desktop webview a plain
 * `<a href>` click navigates the *application window* to that page, so links
 * are marked `rel="noopener noreferrer"` and `target="_blank"`; the global
 * interceptor in `useExternalLinkGuard` then routes them through the validated
 * `open_url` command instead of letting the webview navigate.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName === 'A' && node instanceof Element) {
    if (node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

/**
 * Sanitizes an HTML string using DOMPurify to prevent XSS attacks
 * before rendering untrusted HTML from GameBanana or remote sources.
 *
 * Use this everywhere rather than calling `DOMPurify.sanitize` directly, so the
 * tag allowlist and the anchor hardening above apply consistently.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_TAGS: [
      'a',
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
  });
}
