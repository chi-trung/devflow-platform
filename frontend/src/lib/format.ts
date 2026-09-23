export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Splits an email at the last "@" so the UI can ellipsize the local part
 * while the domain (`@gmail.com`) stays shrink-0 and fully visible —
 * head-truncating the whole address used to clip exactly the informative
 * tail. No "@" (or only a leading one) → the whole string is the local part
 * so the caller still truncates it as one unit.
 */
export function splitEmail(email: string): { local: string; domain: string } {
  const at = email.lastIndexOf("@");
  if (at <= 0) return { local: email, domain: "" };
  return { local: email.slice(0, at), domain: email.slice(at) };
}
