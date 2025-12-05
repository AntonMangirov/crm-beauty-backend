import { Request, Response } from 'express';
import { ClientService } from '../services/ClientService';
import { ClientRepository } from '../repositories/ClientRepository';
import { PhotoRepository } from '../repositories/PhotoRepository';
import {
  ClientListItemSchema,
  ClientHistoryResponseSchema,
  UpdateClientSchema,
} from '../schemas/me';
import { logError } from '../utils/logger';

const clientService = new ClientService(
  new ClientRepository(),
  new PhotoRepository()
);

/**
 * Получить список клиентов мастера с информацией о посещениях
 */
export async function getClients(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, phone, sortBy } = req.query as {
      name?: string;
      phone?: string;
      sortBy?: 'name' | 'lastVisit';
    };

    const clients = await clientService.getClients({
      masterId: userId,
      name,
      phone,
      sortBy,
    });

    const response = clients.map(client => ClientListItemSchema.parse(client));

    return res.json(response);
  } catch (error) {
    logError('Ошибка получения клиентов', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch clients',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Получить историю посещений клиента
 */
export async function getClientHistory(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: clientId } = req.params;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const historyItems = await clientService.getClientHistory(clientId, userId);

    if (!historyItems) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const response = ClientHistoryResponseSchema.parse(historyItems);
    return res.json(response);
  } catch (error) {
    logError('Ошибка получения истории клиента', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch client history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Обновить данные клиента
 */
export async function updateClient(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: clientId } = req.params;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const validatedData = UpdateClientSchema.parse(req.body);
    const updatedClient = await clientService.updateClient(
      clientId,
      userId,
      validatedData
    );

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    return res.json(updatedClient);
  } catch (error) {
    logError('Ошибка обновления клиента', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to update client',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
