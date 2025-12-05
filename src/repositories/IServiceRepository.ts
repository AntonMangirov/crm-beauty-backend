import { Decimal } from '@prisma/client';
export interface ServiceStats {
  id: string;
  name: string;
  price: Decimal;
  durationMin: number;
  count: number;
}

export interface IServiceRepository {
  getTopServices(
    _masterId: string,
    _startDate: Date,
    _limit: number
  ): Promise<ServiceStats[]>;
}
