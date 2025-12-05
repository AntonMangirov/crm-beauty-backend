import { Prisma } from '@prisma/client';
import { IUserRepository } from '../repositories/IUserRepository';
import { geocodeAndCache } from '../utils/geocoding';
import prisma from '../prismaClient';

export interface UpdateProfileData {
  name?: string;
  description?: string | null;
  address?: string | null;
  photoUrl?: string | null;
}

export class ProfileService {
  constructor(private userRepository: IUserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    const stats = await this.userRepository.getStats(userId);

    return {
      ...user,
      lat: user.lat ? Number(user.lat) : null,
      lng: user.lng ? Number(user.lng) : null,
      rating: user.rating ? Number(user.rating) : null,
      stats,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileData) {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.photoUrl !== undefined) {
      updateData.photoUrl = data.photoUrl;
    }

    if (data.address !== undefined) {
      updateData.address = data.address;

      if (data.address) {
        const coordinates = await geocodeAndCache(prisma, userId, data.address);

        if (coordinates) {
          updateData.lat = coordinates.lat;
          updateData.lng = coordinates.lng;
        } else {
          updateData.lat = null;
          updateData.lng = null;
        }
      } else {
        updateData.lat = null;
        updateData.lng = null;
      }
    }

    const updatedUser = await this.userRepository.update(userId, updateData);
    const stats = await this.userRepository.getStats(userId);

    return {
      ...updatedUser,
      lat: updatedUser.lat ? Number(updatedUser.lat) : null,
      lng: updatedUser.lng ? Number(updatedUser.lng) : null,
      rating: updatedUser.rating ? Number(updatedUser.rating) : null,
      stats,
    };
  }
}
