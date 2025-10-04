import { docuFlowAPI } from './apiClient.js';

export async function apiGetDownloadsToday() {
  try {
    const data = await docuFlowAPI.dashboard.getDownloadsToday();
    const count = typeof data === 'number' ? data : data?.count;
    return {
      success: true,
      count: Number.isFinite(count) ? count : 0
    };
  } catch (error) {
    console.error('Error obteniendo descargas del día:', error);
    return { success: false, count: 0, error: error?.message };
  }
}