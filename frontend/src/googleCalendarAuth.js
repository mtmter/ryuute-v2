const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
export const CALENDAR_READONLY_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

let scriptPromise;
let tokenState = null;


export function getCalendarAccessToken(now = Date.now()) {
  if (!tokenState || tokenState.expiresAt <= now) {
    tokenState = null;
    return null;
  }
  return tokenState.accessToken;
}


export function clearCalendarAccessToken() {
  tokenState = null;
}


export function setCalendarTokenForTest(accessToken, expiresAt) {
  tokenState = accessToken ? { accessToken, expiresAt } : null;
}


export function loadGoogleIdentityServices(documentObject = document) {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = documentObject.querySelector(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );
    const script = existing ?? documentObject.createElement("script");
    const handleLoad = () => resolve();
    const handleError = () => {
      scriptPromise = undefined;
      reject(new Error("Google Identity Servicesを読み込めませんでした"));
    };
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      documentObject.head.appendChild(script);
    }
  });
  return scriptPromise;
}


export async function connectGoogleCalendar(
  clientId,
  { load = loadGoogleIdentityServices, now = Date.now } = {},
) {
  if (!clientId) throw new Error("Google Calendar OAuth Client IDが未設定です");
  await load();
  return new Promise((resolve, reject) => {
    const client = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_READONLY_SCOPE,
      callback: (response) => {
        if (response?.error || !response?.access_token) {
          tokenState = null;
          reject(new Error(response?.error_description || "Google Calendarの認可が拒否されました"));
          return;
        }
        const expiresIn = Math.max(Number(response.expires_in) || 0, 0);
        tokenState = {
          accessToken: response.access_token,
          expiresAt: now() + Math.max(expiresIn - 30, 0) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        tokenState = null;
        reject(new Error(error?.message || "Google Calendarへ接続できませんでした"));
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}


export async function disconnectGoogleCalendar() {
  const token = tokenState?.accessToken;
  tokenState = null;
  if (!token || !globalThis.google?.accounts?.oauth2?.revoke) return;
  await new Promise((resolve) => globalThis.google.accounts.oauth2.revoke(token, resolve));
}
