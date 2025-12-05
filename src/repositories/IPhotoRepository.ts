import { Prisma, Photo } from '@prisma/client';

export interface IPhotoRepository {
  findByClientId(_clientId: string): Promise<Photo[]>;
  findByClientIds(_clientIds: string[]): Promise<Photo[]>;
  create(_data: Prisma.PhotoCreateInput): Promise<Photo>;
  findById(_id: string): Promise<Photo | null>;
  delete(_id: string): Promise<void>;
}
