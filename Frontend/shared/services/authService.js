import { docuFlowAPI, persistAuthTokens, clearAuthTokens, getStoredAccessToken, getStoredRefreshToken } from './apiClient.js';
import { store } from './store.js';

const USER_STORAGE_KEY = 'userData';

function persistUser(user) {
  if (user) {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      console.warn('No fue posible persistir el usuario en localStorage:', error);
    }
  }
  store.setUser(user || null);
}

function clearUserStorage() {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('user');
}

export const authService = {
  async login({ username, password }) {
    const normalizedUsername = username?.trim().toLowerCase();
    const payload = { username: normalizedUsername, password };

    try {
      const response = await docuFlowAPI.auth.login(payload);
      if (response?.token) {
        persistAuthTokens({
          token: response.token,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn
        });

        const user = response.user || { username: normalizedUsername, name: normalizedUsername };
        persistUser(user);

        return {
          success: response.success !== false,
          data: response
        };
      }

      return {
        success: false,
        error: response?.error || response?.message || 'No se pudo iniciar sesión',
        data: response
      };
    } catch (error) {
      console.error('Error en authService.login:', error);
      return {
        success: false,
        error: error?.message || 'No se pudo iniciar sesión',
        data: error?.response || null
      };
    }
  },

  async register(userData) {
    const payload = {
      ...userData,
      email: userData?.email?.trim().toLowerCase()
    };
    return docuFlowAPI.auth.register(payload);
  },

  async logout() {
    try {
      await docuFlowAPI.auth.logout();
    } catch (error) {
      console.warn('Fallo al cerrar sesión en el backend, limpiando sesión local igualmente.', error);
    } finally {
      clearAuthTokens();
      clearUserStorage();
      store.logout();
    }
  },

  async refreshSession() {
    try {
      const response = await docuFlowAPI.auth.refreshToken();
      if (response?.token) {
        return response;
      }
      return null;
    } catch (error) {
      this.clearSession();
      return null;
    }
  },

  restoreUserFromStorage() {
    const stored = localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem('user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        store.setUser(user);
        return user;
      } catch (error) {
        console.warn('No se pudo parsear el usuario guardado:', error);
      }
    }
    return store.getState('user');
  },

  clearSession() {
    clearAuthTokens();
    clearUserStorage();
    store.logout();
  },

  getAccessToken() {
    return getStoredAccessToken();
  },

  getRefreshToken() {
    return getStoredRefreshToken();
  }
};

export default authService;
