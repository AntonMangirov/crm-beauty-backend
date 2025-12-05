import { Request, Response } from 'express';
import { ScheduleService } from '../services/ScheduleService';
import { UserRepository } from '../repositories/UserRepository';
import {
  UpdateScheduleSchema,
  UpdateScheduleResponseSchema,
} from '../schemas/me';
import { logError } from '../utils/logger';
import { z } from 'zod';

const scheduleService = new ScheduleService(new UserRepository());

/**
 * Получить расписание работы мастера
 */
export async function getSchedule(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schedule = await scheduleService.getSchedule(userId);

    if (!schedule) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = UpdateScheduleResponseSchema.parse(schedule);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения расписания', error);

    return res.status(500).json({
      error: 'Failed to fetch schedule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить расписание работы мастера
 */
export async function updateSchedule(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = UpdateScheduleSchema.parse(req.body);
    const schedule = await scheduleService.updateSchedule(
      userId,
      validatedData
    );

    const response = UpdateScheduleResponseSchema.parse(schedule);
    return res.json(response);
  } catch (error) {
    logError('Ошибка обновления расписания', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Ошибка валидации данных расписания',
        details: error.flatten(),
      });
    }

    return res.status(500).json({
      error: 'Failed to update schedule',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
