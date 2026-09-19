const SESSION_KEY = "ckd-current-session";

export function getDeviceSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function rememberDeviceSession(code: string): boolean {
  try {
    window.localStorage.setItem(SESSION_KEY, code);
    return true;
  } catch {
    return false;
  }
}

export function forgetDeviceSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable in private or restricted browsers.
  }
}
