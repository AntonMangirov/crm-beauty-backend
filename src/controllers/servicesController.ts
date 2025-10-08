import { Request, Response } from 'express';
import prisma from '../prismaClient';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ServiceResponseSchema,
  ServicesListResponseSchema,
} from '../schemas/services';

// Получить все услуги мастера
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

    const response = ServicesListResponseSchema.parse(services);
    return res.json(response);
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({
      error: 'Failed to fetch services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Создать новую услугу
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

    const response = ServiceResponseSchema.parse(service);
    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating service:', error);

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

// Обновить услугу
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

    // Проверяем, что услуга принадлежит мастеру
    const existingService = await prisma.service.findFirst({
      where: { id, masterId },
    });

    if (!existingService) {
      return res
        .status(404)
        .json({ error: 'Service not found or access denied' });
    }

    const validatedData = UpdateServiceSchema.parse(req.body);

    const service = await prisma.service.update({
      where: { id },
      data: validatedData,
    });

    const response = ServiceResponseSchema.parse(service);
    return res.json(response);
  } catch (error) {
    console.error('Error updating service:', error);

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

// Удалить услугу
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

    // Проверяем, что услуга принадлежит мастеру
    const existingService = await prisma.service.findFirst({
      where: { id, masterId },
    });

    if (!existingService) {
      return res
        .status(404)
        .json({ error: 'Service not found or access denied' });
    }

    // Проверяем, есть ли активные записи на эту услугу
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
    console.error('Error deleting service:', error);
    return res.status(500).json({
      error: 'Failed to delete service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Получить услугу по ID
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

    const service = await prisma.service.findFirst({
      where: { id, masterId },
    });

    if (!service) {
      return res
        .status(404)
        .json({ error: 'Service not found or access denied' });
    }

    const response = ServiceResponseSchema.parse(service);
    return res.json(response);
  } catch (error) {
    console.error('Error fetching service:', error);
    return res.status(500).json({
      error: 'Failed to fetch service',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
