const STORAGE_KEY = "snapic_anonymous_session";

export function getAnonymousSessionId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearAnonymousSessionId(): void {
  localStorage.removeItem(STORAGE_KEY);
}
