import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ServiceResponseSchema,
  ServicesListResponseSchema,
} from '../schemas/services';
import { ServiceNotFoundError } from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';
import { logError } from '../utils/logger';

export async function getServices(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const services = await prisma.service.findMany({
      where: { masterId },
      orderBy: { createdAt: 'desc' },
    });

    const servicesWithNumbers = services.map(service => ({
      ...service,
      price: Number(service.price),
    }));

    const response = ServicesListResponseSchema.parse(servicesWithNumbers);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения услуг', error);
    return res.status(500).json({
      error: 'Failed to fetch services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function createService(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = CreateServiceSchema.parse(req.body);

    const service = await prisma.service.create({
      data: {
        ...validatedData,
        masterId,
      },
    });

    const serviceWithNumber = {
      ...service,
      price: Number(service.price),
    };

    const response = ServiceResponseSchema.parse(serviceWithNumber);
    return res.status(201).json(response);
  } catch (error) {
    logError('Ошибка создания услуги', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to create service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function updateService(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      const notFoundError = new ServiceNotFoundError(id);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (existingService.masterId !== masterId) {
      const forbiddenError = new ForbiddenError(
        'Service does not belong to the current user',
        'SERVICE_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const validatedData = UpdateServiceSchema.parse(req.body);

    const service = await prisma.service.update({
      where: { id },
      data: validatedData,
    });

    const serviceWithNumber = {
      ...service,
      price: Number(service.price),
    };

    const response = ServiceResponseSchema.parse(serviceWithNumber);
    return res.json(response);
  } catch (error) {
    logError('Ошибка обновления услуги', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to update service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function deleteService(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    const existingService = await prisma.service.findUnique({
      where: { id },
    });

    if (!existingService) {
      const notFoundError = new ServiceNotFoundError(id);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (existingService.masterId !== masterId) {
      const forbiddenError = new ForbiddenError(
        'Service does not belong to the current user',
        'SERVICE_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const activeAppointments = await prisma.appointment.findFirst({
      where: {
        serviceId: id,
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    });

    if (activeAppointments) {
      return res.status(400).json({
        error: 'Cannot delete service with active appointments',
        message:
          'Please cancel or complete all appointments for this service first',
      });
    }

    await prisma.service.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (error) {
    logError('Ошибка удаления услуги', error);

    return res.status(500).json({
      error: 'Failed to delete service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getServiceById(req: Request, res: Response) {
  try {
    const masterId = req.user?.id;
    if (!masterId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      const notFoundError = new ServiceNotFoundError(id);
      return res.status(notFoundError.statusCode).json({
        error: notFoundError.message,
        code: notFoundError.code,
      });
    }

    if (service.masterId !== masterId) {
      const forbiddenError = new ForbiddenError(
        'Service does not belong to the current user',
        'SERVICE_ACCESS_DENIED'
      );
      return res.status(forbiddenError.statusCode).json({
        error: forbiddenError.message,
        code: forbiddenError.code,
      });
    }

    const serviceWithNumber = {
      ...service,
      price: Number(service.price),
    };

    const response = ServiceResponseSchema.parse(serviceWithNumber);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения услуги', error);

    return res.status(500).json({
      error: 'Failed to fetch service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
