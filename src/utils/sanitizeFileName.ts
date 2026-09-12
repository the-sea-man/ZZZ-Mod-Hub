export function sanitizeFileName(name: string): string {
  if (!name) return "unnamed";

  // Strip control characters and invalid Windows filename characters: < > : " / \ | ? *
  let sanitized = name.replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, "_");

  // Prevent relative path traversal sequences
  sanitized = sanitized.replace(/\.\.+/g, "_");

  // Prevent reserved Windows filenames
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reserved.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // Trim trailing dots and spaces
  sanitized = sanitized.replace(/[. ]+$/, "");

  return sanitized || "unnamed";
}
