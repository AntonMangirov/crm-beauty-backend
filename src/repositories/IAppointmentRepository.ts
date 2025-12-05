import { Prisma, Appointment } from '@prisma/client';

export interface AppointmentWithRelations extends Appointment {
  client: {
    id: string;
    name: string;
    phone: string | null;
    telegramUsername: string | null;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
    price: Prisma.Decimal;
    durationMin: number;
  };
}

export interface AppointmentFilters {
  masterId: string;
  from?: Date;
  to?: Date;
  status?: string;
  serviceId?: string;
  clientId?: string;
}

export interface IAppointmentRepository {
  findById(_id: string): Promise<Appointment | null>;
  findByIdWithRelations(_id: string): Promise<AppointmentWithRelations | null>;
  findMany(_filters: AppointmentFilters): Promise<AppointmentWithRelations[]>;
  findLastManual(
    _masterId: string,
    _limit: number
  ): Promise<
    Array<{
      id: string;
      serviceId: string;
      service: {
        id: string;
        name: string;
        price: Prisma.Decimal;
        durationMin: number;
      };
      createdAt: Date;
    }>
  >;
  update(
    _id: string,
    _data: Prisma.AppointmentUpdateInput
  ): Promise<Appointment>;
  findOverlapping(
    _masterId: string,
    _startAt: Date,
    _endAt: Date,
    _excludeId?: string
  ): Promise<Appointment | null>;
}
