/**
 * Утилиты для работы с клиентами
 */

import prisma from '../prismaClient';

/**
 * Безопасное удаление клиента (деактивация)
 * Запрещает физическое удаление, если есть Appointment
 * Вместо удаления устанавливает isActive = false
 *
 * @param clientId - ID клиента для удаления
 * @throws Error если клиент имеет записи (Appointment)
 * @returns обновленный клиент с isActive = false
 */
export async function safeDeleteClient(clientId: string) {
  // Проверяем наличие записей у клиента
  const appointments = await prisma.appointment.findFirst({
    where: {
      clientId,
    },
  });

  if (appointments) {
    throw new Error(
      'Cannot delete client with existing appointments. Client has appointment history and cannot be deleted.'
    );
  }

  // Деактивируем клиента вместо физического удаления
  return await prisma.client.update({
    where: { id: clientId },
    data: { isActive: false },
  });
}
