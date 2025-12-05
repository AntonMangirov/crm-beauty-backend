import { Prisma, User } from '@prisma/client';

export interface IUserRepository {
  findById(_id: string): Promise<User | null>;
  findByEmail(_email: string): Promise<User | null>;
  findBySlug(_slug: string): Promise<User | null>;
  update(_id: string, _data: Prisma.UserUpdateInput): Promise<User>;
  getStats(_masterId: string): Promise<{
    totalServices: number;
    activeServices: number;
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
    totalClients: number;
  }>;
}
