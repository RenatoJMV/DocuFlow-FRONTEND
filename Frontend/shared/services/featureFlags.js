const STORAGE_KEY = 'docuflow_feature_flags';

const DEFAULT_FLAGS = {
  gcsStats: false,
  gcsOrphanTools: false,
  experimentalUploads: false
};

let cachedFlags = loadStoredFlags();
const subscribers = new Set();

function loadStoredFlags() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_FLAGS };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_FLAGS };
    }

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_FLAGS,
      ...parsed
    };
  } catch (error) {
    console.warn('No se pudieron cargar los feature flags almacenados:', error);
    return { ...DEFAULT_FLAGS };
  }
}

function persistFlags() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedFlags));
  } catch (error) {
    console.warn('No se pudieron persistir los feature flags:', error);
  }
}

function notifySubscribers(flagKey) {
  subscribers.forEach((listener) => {
    try {
      listener(flagKey, cachedFlags[flagKey], { ...cachedFlags });
    } catch (error) {
      console.warn('Error notificando cambio de feature flag:', error);
    }
  });
}

export const featureFlags = {
  /**
   * Devuelve el estado de un flag específico.
   * @param {string} flagKey
   * @returns {boolean}
   */
  isEnabled(flagKey) {
    return Boolean(cachedFlags[flagKey]);
  },

  /**
   * Define el valor de un flag.
   * @param {string} flagKey
   * @param {boolean} enabled
   */
  set(flagKey, enabled) {
    if (cachedFlags[flagKey] === enabled) {
      return;
    }

    cachedFlags = {
      ...cachedFlags,
      [flagKey]: Boolean(enabled)
    };

    persistFlags();
    notifySubscribers(flagKey);
  },

  enable(flagKey) {
    this.set(flagKey, true);
  },

  disable(flagKey) {
    this.set(flagKey, false);
  },

  /**
   * Obtiene todos los flags actuales.
   */
  all() {
    return { ...cachedFlags };
  },

  /**
   * Restaura los flags a su estado por defecto.
   */
  reset() {
    cachedFlags = { ...DEFAULT_FLAGS };
    persistFlags();
    subscribers.forEach((listener) => {
      try {
        listener('*', null, { ...cachedFlags });
      } catch (error) {
        console.warn('Error notificando reset de feature flags:', error);
      }
    });
  },

  /**
   * Permite escuchar cambios en los flags.
   * @param {(flagKey: string, value: boolean, flags: Record<string, boolean>) => void} listener
   * @returns {() => void} función para cancelar la suscripción
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }
};

// Exponer utilidades en desarrollo para depuración rápida
if (typeof window !== 'undefined') {
  window.DocuFlowFeatureFlags = featureFlags;
}
