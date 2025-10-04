// Test rápido de conexión al backend
console.log('🔗 Verificando conexión al backend...');

const isLocalEnv = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Test básico de conectividad
async function testBackendConnection() {
  if (!isLocalEnv) {
    console.log('ℹ️ Saltando prueba de backend en este entorno (no es localhost).');
    return null;
  }

  const testUrls = [
    'http://localhost:8080/health/simple',
    'http://localhost:8080/health',
    'http://localhost:8080/notifications'
  ];

  for (const url of testUrls) {
    try {
      console.log(`🧪 Probando: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.text();
        console.log(`✅ Backend disponible en: ${url}`);
        console.log(`📄 Respuesta:`, data);
        return url;
      } else {
        console.warn(`⚠️ ${url} responde con error: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${url} no disponible:`, error.message);
    }
  }
  
  console.error('❌ Backend no disponible en ningún endpoint');
  console.log('💡 Asegúrate de que tu backend esté ejecutándose en http://localhost:8080');
  return null;
}

// Ejecutar test al cargar la página solo en local
if (isLocalEnv) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testBackendConnection);
  } else {
    testBackendConnection();
  }
}

// También hacer disponible globalmente
window.testBackendConnection = testBackendConnection;