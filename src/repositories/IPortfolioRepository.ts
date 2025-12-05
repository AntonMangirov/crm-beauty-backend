import { Prisma, PortfolioPhoto } from '@prisma/client';

export interface IPortfolioRepository {
  findByMasterId(_masterId: string): Promise<PortfolioPhoto[]>;
  create(_data: Prisma.PortfolioPhotoCreateInput): Promise<PortfolioPhoto>;
  findById(_id: string): Promise<PortfolioPhoto | null>;
  delete(_id: string): Promise<void>;
}
