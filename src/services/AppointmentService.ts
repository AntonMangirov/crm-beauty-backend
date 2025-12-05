import {
  IAppointmentRepository,
  AppointmentFilters,
} from '../repositories/IAppointmentRepository';
import { IPhotoRepository } from '../repositories/IPhotoRepository';
import {
  AppointmentNotFoundError,
  TimeSlotConflictError,
} from '../errors/BusinessErrors';
import { ForbiddenError } from '../errors/AppError';

export class AppointmentService {
  constructor(
    private appointmentRepository: IAppointmentRepository,
    private photoRepository: IPhotoRepository
  ) {}

  async getAppointments(filters: AppointmentFilters) {
    const appointments = await this.appointmentRepository.findMany(filters);

    const clientIds = [...new Set(appointments.map(apt => apt.clientId))];
    const allPhotos = await this.photoRepository.findByClientIds(clientIds);

    const appointmentsWithPhotos = appointments.map((appointment, index) => {
      const appointmentDate = new Date(appointment.startAt);
      appointmentDate.setHours(0, 0, 0, 0);

      const nextAppointment = appointments.find((apt, idx) => {
        if (idx <= index || apt.clientId !== appointment.clientId) {
          return false;
        }
        const nextAppointmentDate = new Date(apt.startAt);
        nextAppointmentDate.setHours(0, 0, 0, 0);
        return nextAppointmentDate < appointmentDate;
      });

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
            return (
              photo.clientId === appointment.clientId &&
              photoDate >= periodStart &&
              photoDate <= periodEnd
            );
          }
          return false;
        })
        .map(photo => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          createdAt: photo.createdAt,
        }));

      return {
        id: appointment.id,
        masterId: appointment.masterId,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        status: appointment.status,
        source: appointment.source,
        notes: appointment.notes,
        price: appointment.price ? Number(appointment.price) : null,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        client: appointment.client,
        service: {
          ...appointment.service,
          price: Number(appointment.service.price),
        },
        photos: relatedPhotos,
      };
    });

    return appointmentsWithPhotos;
  }

  async updateStatus(appointmentId: string, masterId: string, status: string) {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    if (appointment.masterId !== masterId) {
      throw new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
    }

    const updatedAppointment = await this.appointmentRepository.update(
      appointmentId,
      { status: status as unknown }
    );

    const appointmentWithRelations =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointmentWithRelations) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    return {
      id: updatedAppointment.id,
      masterId: updatedAppointment.masterId,
      clientId: updatedAppointment.clientId,
      serviceId: updatedAppointment.serviceId,
      startAt: updatedAppointment.startAt,
      endAt: updatedAppointment.endAt,
      status: updatedAppointment.status,
      source: updatedAppointment.source,
      notes: updatedAppointment.notes,
      price: updatedAppointment.price ? Number(updatedAppointment.price) : null,
      createdAt: updatedAppointment.createdAt,
      updatedAt: updatedAppointment.updatedAt,
      client: appointmentWithRelations.client,
      service: {
        ...appointmentWithRelations.service,
        price: Number(appointmentWithRelations.service.price),
      },
    };
  }

  async reschedule(appointmentId: string, masterId: string, newStartAt: Date) {
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    if (appointment.masterId !== masterId) {
      throw new ForbiddenError(
        'Appointment does not belong to the current user',
        'APPOINTMENT_ACCESS_DENIED'
      );
    }

    if (newStartAt < new Date()) {
      throw new Error('Cannot reschedule to past time');
    }

    const durationMs = appointment.service.durationMin * 60 * 1000;
    const newEndAt = new Date(newStartAt.getTime() + durationMs);

    const overlapping = await this.appointmentRepository.findOverlapping(
      masterId,
      newStartAt,
      newEndAt,
      appointmentId
    );

    if (overlapping) {
      throw new TimeSlotConflictError(
        newStartAt.toISOString(),
        newEndAt.toISOString()
      );
    }

    const updatedAppointment = await this.appointmentRepository.update(
      appointmentId,
      {
        startAt: newStartAt,
        endAt: newEndAt,
      }
    );

    const updatedWithRelations =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!updatedWithRelations) {
      throw new AppointmentNotFoundError(appointmentId);
    }

    return {
      id: updatedAppointment.id,
      masterId: updatedAppointment.masterId,
      clientId: updatedAppointment.clientId,
      serviceId: updatedAppointment.serviceId,
      startAt: updatedAppointment.startAt,
      endAt: updatedAppointment.endAt,
      status: updatedAppointment.status,
      source: updatedAppointment.source,
      notes: updatedAppointment.notes,
      price: updatedAppointment.price ? Number(updatedAppointment.price) : null,
      createdAt: updatedAppointment.createdAt,
      updatedAt: updatedAppointment.updatedAt,
      client: updatedWithRelations.client,
      service: {
        ...updatedWithRelations.service,
        price: Number(updatedWithRelations.service.price),
      },
    };
  }

  async getLastManual(masterId: string, limit: number) {
    const appointments = await this.appointmentRepository.findLastManual(
      masterId,
      limit
    );

    return appointments.map(apt => ({
      id: apt.id,
      serviceId: apt.serviceId,
      service: {
        id: apt.service.id,
        name: apt.service.name,
        price: Number(apt.service.price),
        durationMin: apt.service.durationMin,
      },
      createdAt: apt.createdAt,
    }));
  }
}
