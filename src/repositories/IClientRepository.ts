import { Prisma, Client } from '@prisma/client';

export interface ClientWithStats extends Omit<Client, 'appointments'> {
  appointments: Array<{ startAt: Date }>;
  _count: {
    photos: number;
  };
}

export interface ClientFilters {
  masterId: string;
  name?: string;
  phone?: string;
}

export interface IClientRepository {
  findById(_id: string): Promise<Client | null>;
  findByIdWithMaster(_id: string, _masterId: string): Promise<Client | null>;
  findMany(_filters: ClientFilters): Promise<ClientWithStats[]>;
  update(_id: string, _data: Prisma.ClientUpdateInput): Promise<Client>;
  getHistory(
    _clientId: string,
    _masterId: string
  ): Promise<
    Array<{
      id: string;
      startAt: Date;
      status: string;
      serviceId: string;
      serviceName: string | null;
      serviceDuration: number | null;
      servicePrice: Prisma.Decimal | null;
      price: Prisma.Decimal | null;
      service: {
        id: string;
        name: string;
        price: Prisma.Decimal;
      } | null;
    }>
  >;
}
