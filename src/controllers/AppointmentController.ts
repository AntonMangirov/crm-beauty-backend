import { Request, Response } from 'express';
import { AppointmentService } from '../services/AppointmentService';
import { AppointmentRepository } from '../repositories/AppointmentRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import {
  AppointmentsFilterSchema,
  UpdateAppointmentStatusSchema,
  RescheduleAppointmentSchema,
} from '../schemas/me';
import {
  AppointmentNotFoundError,
  TimeSlotConflictError,
} from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';
import { logError } from '../utils/logger';

const appointmentService = new AppointmentService(
  new AppointmentRepository(),
  new PhotoRepository()
);

/**
 * Получить записи мастера с фильтрами
 */
export async function getAppointments(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = AppointmentsFilterSchema.parse(req.query);
    const dateFrom = filters.from || filters.dateFrom;
    const dateTo = filters.to || filters.dateTo;

    const appointments = await appointmentService.getAppointments({
      masterId: userId,
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
      status: filters.status,
      serviceId: filters.serviceId,
      clientId: filters.clientId,
    });

    return res.json(appointments);
  } catch (error) {
    logError('Ошибка получения записей', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить статус записи
 */
export async function updateAppointmentStatus(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const validatedData = UpdateAppointmentStatusSchema.parse(req.body);
    const response = await appointmentService.updateStatus(
      id,
      masterId,
      validatedData.status
    );

    return res.json(response);
  } catch (error) {
    logError('Ошибка обновления статуса записи', error);

    if (
      error instanceof AppointmentNotFoundError ||
      error instanceof ForbiddenError
    ) {
      const appError = error as AppointmentNotFoundError | ForbiddenError;
      return res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code,
      });
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to update appointment status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Перенести встречу (изменить время)
 */
export async function rescheduleAppointment(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const validatedData = RescheduleAppointmentSchema.parse(req.body);
    const newStartAt = new Date(validatedData.startAt);

    const response = await appointmentService.reschedule(
      id,
      masterId,
      newStartAt
    );

    return res.json(response);
  } catch (error) {
    logError('Ошибка переноса встречи', error);

    if (
      error instanceof AppointmentNotFoundError ||
      error instanceof ForbiddenError ||
      error instanceof TimeSlotConflictError
    ) {
      const appError = error as
        | AppointmentNotFoundError
        | ForbiddenError
        | TimeSlotConflictError;
      return res.status(appError.statusCode).json({
        error: appError.message,
        code: appError.code,
      });
    }

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          error: 'Validation error',
          details: error.message,
        });
      }
      if (error.message === 'Cannot reschedule to past time') {
        return res.status(400).json({
          error: 'Cannot reschedule to past time',
          message: 'Нельзя перенести встречу на прошедшее время',
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to reschedule appointment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить последние ручные записи мастера
 */
export async function getLastManualAppointments(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 3;
    const maxLimit = Math.min(limit, 10);

    const response = await appointmentService.getLastManual(userId, maxLimit);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения последних ручных записей', error);
    return res.status(500).json({
      error: 'Failed to fetch last manual appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
