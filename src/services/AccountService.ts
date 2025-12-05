import { IUserRepository } from '../repositories/IUserRepository';
import { hashPassword, verifyPassword } from '../utils/password';

export class AccountService {
  constructor(private userRepository: IUserRepository) {}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
    });

    return {
      success: true,
      message: 'Пароль успешно изменен',
    };
  }

  async changeEmail(userId: string, newEmail: string, password: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const existingUser = await this.userRepository.findByEmail(newEmail);

    if (existingUser && existingUser.id !== userId) {
      throw new Error('Email already exists');
    }

    await this.userRepository.update(userId, {
      email: newEmail,
    });

    return {
      success: true,
      message: 'Email успешно изменен',
      email: newEmail,
    };
  }

  async changePhone(userId: string, newPhone: string) {
    let normalizedPhone = newPhone.trim();
    if (normalizedPhone.startsWith('8')) {
      normalizedPhone = '+7' + normalizedPhone.slice(1);
    } else if (
      normalizedPhone.startsWith('7') &&
      !normalizedPhone.startsWith('+7')
    ) {
      normalizedPhone = '+' + normalizedPhone;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+7' + normalizedPhone;
    }

    const updatedUser = await this.userRepository.update(userId, {
      phone: normalizedPhone,
    });

    return {
      success: true,
      message: 'Телефон успешно изменен',
      phone: updatedUser.phone,
    };
  }
}
