// WCAG 2.1.4 Character Key Shortcuts (Level A): any action bound to a
// printable character key must be turn-off-able. The board binds n, /, f
// and ? globally, so this preference disables exactly those; modifier
// chords (Ctrl/Cmd+A) and non-character keys (Delete, Escape) are exempt
// from the criterion and always work. Read at keystroke time so a toggle
// in Settings takes effect without a reload, and default to enabled so
// existing behavior only changes when the user opts out.

const STORAGE_KEY = "devflow.boardShortcuts";

export function areCharacterShortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    // Storage blocked (private mode, embedder policy): keep default behavior.
    return true;
  }
}

export function setCharacterShortcutsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Persistence unavailable; the caller's in-memory state still updates.
  }
}
