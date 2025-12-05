import { Request, Response } from 'express';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { logError } from '../utils/logger';

const serviceRepository = new ServiceRepository();

/**
 * Получить топ-5 наиболее используемых услуг мастера
 */
export async function getTopServices(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const days = parseInt(req.query.days as string) || 90;
    const limit = parseInt(req.query.limit as string) || 5;
    const maxLimit = Math.min(limit, 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const serviceStats = await serviceRepository.getTopServices(
      userId,
      startDate,
      maxLimit
    );

    const response = serviceStats.map(stat => ({
      id: stat.id,
      name: stat.name,
      price: Number(stat.price),
      durationMin: stat.durationMin,
      usageCount: Number(stat.count),
    }));

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения топ услуг', error);
    return res.status(500).json({
      error: 'Failed to fetch top services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
