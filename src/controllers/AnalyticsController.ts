import { Request, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { AnalyticsResponseSchema } from '../schemas/me';
import { logError } from '../utils/logger';

const analyticsService = new AnalyticsService();

/**
 * Получить аналитику за текущий месяц
 */
export async function getAnalytics(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const analytics = await analyticsService.getAnalytics(userId);
    const response = AnalyticsResponseSchema.parse(analytics);

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения аналитики', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
