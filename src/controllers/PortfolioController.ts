import { Request, Response } from 'express';
import { PortfolioService } from '../services/PortfolioService';
import { PortfolioRepository } from '../repositories/PortfolioRepository';
import { logError } from '../utils/logger';

const portfolioService = new PortfolioService(new PortfolioRepository());

/**
 * Получить портфолио мастера
 */
export async function getPortfolio(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const portfolio = await portfolioService.getPortfolio(userId);
    return res.json(portfolio);
  } catch (error) {
    logError('Ошибка получения портфолио', error);
    return res.status(500).json({
      error: 'Failed to fetch portfolio',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Загрузить фото в портфолио
 */
export async function uploadPortfolioPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const description = req.body.description || null;
    const response = await portfolioService.uploadPhoto(
      userId,
      req.file,
      description
    );

    return res.status(201).json(response);
  } catch (error) {
    logError('Ошибка загрузки фото портфолио', error);
    return res.status(500).json({
      error: 'Failed to upload portfolio photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Удалить фото из портфолио
 */
export async function deletePortfolioPhoto(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: photoId } = req.params;
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    await portfolioService.deletePhoto(photoId, userId);
    return res.status(204).send();
  } catch (error) {
    logError('Ошибка удаления фото портфолио', error);

    if (error instanceof Error && error.message === 'Photo not found') {
      return res.status(404).json({ error: error.message });
    }

    if (
      error instanceof Error &&
      error.message === 'Photo does not belong to the current user'
    ) {
      return res.status(403).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to delete portfolio photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
