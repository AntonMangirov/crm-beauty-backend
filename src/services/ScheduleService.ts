import { Prisma } from '@prisma/client';
import { IUserRepository } from '../repositories/IUserRepository';

export interface ScheduleData {
  workSchedule?: unknown;
  breaks?: unknown;
  defaultBufferMinutes?: number;
  slotStepMinutes?: number;
}

export class ScheduleService {
  constructor(private userRepository: IUserRepository) {}

  async getSchedule(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    return {
      success: true,
      message: 'Расписание успешно получено',
      schedule: {
        workSchedule: user.workSchedule,
        breaks: user.breaks,
        defaultBufferMinutes: user.defaultBufferMinutes,
        slotStepMinutes: user.slotStepMinutes,
      },
    };
  }

  async updateSchedule(userId: string, data: ScheduleData) {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.workSchedule !== undefined) {
      updateData.workSchedule = data.workSchedule as Prisma.InputJsonValue;
    }

    if (data.breaks !== undefined) {
      updateData.breaks = data.breaks as Prisma.InputJsonValue;
    }

    if (data.defaultBufferMinutes !== undefined) {
      updateData.defaultBufferMinutes = data.defaultBufferMinutes;
    }

    if (data.slotStepMinutes !== undefined) {
      updateData.slotStepMinutes = data.slotStepMinutes;
    }

    const updatedUser = await this.userRepository.update(userId, updateData);

    return {
      success: true,
      message: 'Расписание успешно обновлено',
      schedule: {
        workSchedule: updatedUser.workSchedule,
        breaks: updatedUser.breaks,
        defaultBufferMinutes: updatedUser.defaultBufferMinutes,
        slotStepMinutes: updatedUser.slotStepMinutes,
      },
    };
  }
}
