import DOMPurify from 'dompurify';

/**
 * Sanitizes an HTML string using DOMPurify to prevent XSS attacks
 * before rendering untrusted HTML from GameBanana or remote sources.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_TAGS: [
      'a', 'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 'hr',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table',
      'thead', 'tbody', 'tr', 'th', 'td'
    ],
  });
}
