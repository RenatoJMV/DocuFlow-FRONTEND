import authService from '../services/authService.js';
import { store } from '../services/store.js';

const REDIRECT_MESSAGE_KEY = 'authRedirectMessage';
const REDIRECT_REASON_KEY = 'authRedirectReason';

function resolveLoginUrl(loginPath) {
  try {
    return new URL(loginPath, window.location.href).toString();
  } catch (error) {
    console.warn('No se pudo resolver la URL de login, usando ruta relativa por defecto.', error);
    return loginPath;
  }
}

function buildReturnUrl() {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

function ensureUserLoaded() {
  try {
    const hasUser = !!store.getState('user');
    const hasToken = !!localStorage.getItem('token');

    if (!hasUser && hasToken && typeof authService.restoreUserFromStorage === 'function') {
      authService.restoreUserFromStorage();
    }
  } catch (error) {
    console.warn('No se pudo restaurar el usuario desde el almacenamiento.', error);
  }
}

export function enforcePageAuth(options = {}) {
  const {
  loginPath = '../auth/access-portal.html',
    message = 'Tu sesión ha expirado. Inicia sesión para continuar.',
    reason = 'auth_required',
    restoreUser = true
  } = options;

  try {
    if (restoreUser) {
      ensureUserLoaded();
    }

    const isAuthenticated = typeof store.isAuthenticated === 'function'
      ? store.isAuthenticated()
      : Boolean(store.getState('user') && localStorage.getItem('token'));

    if (isAuthenticated) {
      return true;
    }

    const loginUrl = resolveLoginUrl(loginPath);
    const targetUrl = buildReturnUrl();

    setAuthRedirectContext({
      message,
      reason,
      redirectUrl: targetUrl
    });

    window.location.replace(loginUrl);
    return false;
  } catch (error) {
    console.error('Error aplicando la guardia de autenticación:', error);
    // En caso de error inesperado, permitimos el acceso para no romper la app
    return true;
  }
}

export function consumeAuthRedirectMessage() {
  const message = sessionStorage.getItem(REDIRECT_MESSAGE_KEY);
  const reason = sessionStorage.getItem(REDIRECT_REASON_KEY);

  if (message) {
    sessionStorage.removeItem(REDIRECT_MESSAGE_KEY);
  }
  if (reason) {
    sessionStorage.removeItem(REDIRECT_REASON_KEY);
  }

  return {
    message: message || null,
    reason: reason || null
  };
}

export function clearAuthRedirectContext() {
  sessionStorage.removeItem(REDIRECT_MESSAGE_KEY);
  sessionStorage.removeItem(REDIRECT_REASON_KEY);
  sessionStorage.removeItem('redirectUrl');
}

export function setAuthRedirectContext({ message, reason = 'auth_required', redirectUrl } = {}) {
  if (redirectUrl) {
    sessionStorage.setItem('redirectUrl', redirectUrl);
  }

  if (message) {
    sessionStorage.setItem(REDIRECT_MESSAGE_KEY, message);
  } else {
    sessionStorage.removeItem(REDIRECT_MESSAGE_KEY);
  }

  if (reason) {
    sessionStorage.setItem(REDIRECT_REASON_KEY, reason);
  } else {
    sessionStorage.removeItem(REDIRECT_REASON_KEY);
  }
}
