import { FastifyInstance } from 'fastify';
import { SettingsService } from '../services/settings.js';

export async function setupSettingsRoutes(fastify: FastifyInstance) {
  const settingsService = SettingsService.getInstance();

  fastify.get('/settings', async (request, reply) => {
    const settings = settingsService.getAllSettings();
    const configured = settingsService.isConfigured();

    return {
      ...settings,
      isConfigured: configured
    };
  });

  fastify.put('/settings', async (request, reply) => {
    const updates = request.body as any;
    settingsService.updateSettings(updates);

    return {
      success: true,
      isConfigured: settingsService.isConfigured()
    };
  });
}