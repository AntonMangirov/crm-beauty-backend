import { Prisma } from '@prisma/client';
import { IClientRepository } from '../repositories/IClientRepository';
import { IPhotoRepository } from '../repositories/IPhotoRepository';

export interface ClientSortBy {
  sortBy?: 'name' | 'lastVisit';
}

export class ClientService {
  constructor(
    private clientRepository: IClientRepository,
    private photoRepository: IPhotoRepository
  ) {}

  async getClients(filters: {
    masterId: string;
    name?: string;
    phone?: string;
    sortBy?: 'name' | 'lastVisit';
  }) {
    const clients = await this.clientRepository.findMany({
      masterId: filters.masterId,
      name: filters.name,
      phone: filters.phone,
    });

    const clientsWithStats = clients.map(client => {
      const appointments = client.appointments;
      const lastVisit =
        appointments.length > 0 ? appointments[0].startAt : null;
      const firstVisit =
        appointments.length > 0
          ? appointments[appointments.length - 1].startAt
          : null;
      const visitsCount = appointments.length;
      const photosCount = client._count.photos;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        telegramUsername: client.telegramUsername,
        firstVisit,
        lastVisit,
        visitsCount,
        photosCount,
        notes: client.notes,
      };
    });

    let sortedClients = clientsWithStats;
    if (filters.sortBy === 'lastVisit') {
      sortedClients = [...clientsWithStats].sort((a, b) => {
        if (!a.lastVisit && !b.lastVisit) return 0;
        if (!a.lastVisit) return 1;
        if (!b.lastVisit) return -1;
        return b.lastVisit.getTime() - a.lastVisit.getTime();
      });
    } else if (filters.sortBy === 'name') {
      sortedClients = [...clientsWithStats].sort((a, b) => {
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
      });
    }

    return sortedClients;
  }

  async getClientHistory(clientId: string, masterId: string) {
    const client = await this.clientRepository.findByIdWithMaster(
      clientId,
      masterId
    );

    if (!client) {
      return null;
    }

    const appointments = await this.clientRepository.getHistory(
      clientId,
      masterId
    );
    const allPhotos = await this.photoRepository.findByClientId(clientId);

    const historyItems = appointments.map((appointment, index) => {
      const appointmentDate = new Date(appointment.startAt);
      appointmentDate.setHours(0, 0, 0, 0);

      const nextAppointment = appointments[index + 1];
      let periodStart: Date;
      let periodEnd: Date;
      if (nextAppointment) {
        periodStart = new Date(nextAppointment.startAt);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(appointmentDate);
        periodEnd.setHours(23, 59, 59, 999);
      } else {
        periodStart = appointmentDate;
        periodEnd = new Date(appointmentDate);
        periodEnd.setHours(23, 59, 59, 999);
      }

      const relatedPhotos = allPhotos
        .filter(photo => {
          if (photo.appointmentId === appointment.id) {
            return true;
          }
          if (!photo.appointmentId) {
            const photoDate = new Date(photo.createdAt);
            return photoDate >= periodStart && photoDate <= periodEnd;
          }
          return false;
        })
        .map(photo => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        }));

      const serviceData = appointment.service
        ? {
            id: appointment.service.id,
            name: appointment.service.name,
            price: Number(appointment.service.price),
          }
        : {
            id: appointment.serviceId,
            name: appointment.serviceName || 'Услуга удалена',
            price: Number(appointment.servicePrice || appointment.price || 0),
          };

      return {
        id: appointment.id,
        date: appointment.startAt,
        service: serviceData,
        status: appointment.status,
        photos: relatedPhotos,
      };
    });

    return historyItems;
  }

  async updateClient(
    clientId: string,
    masterId: string,
    data: { name?: string; notes?: string | null }
  ) {
    const client = await this.clientRepository.findByIdWithMaster(
      clientId,
      masterId
    );

    if (!client) {
      return null;
    }

    const updateData: Prisma.ClientUpdateInput = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim() || '-';
    }
    if (data.notes !== undefined) {
      updateData.notes =
        data.notes === null || data.notes.trim() === ''
          ? null
          : data.notes.trim();
    }

    return this.clientRepository.update(clientId, updateData);
  }
}
