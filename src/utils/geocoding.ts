/**
 * Утилита для геокодинга адресов через Nominatim API (OpenStreetMap)
 *
 * Особенности:
 * - Бесплатный сервис
 * - Rate limit: 1 запрос в секунду (соблюдается автоматически)
 * - Кеширование результатов в БД (не делаем повторные запросы)
 *
 * Альтернативы:
 * - Yandex Geocoder API (платный, но точнее для России)
 * - DaData (платный, очень точный для России)
 */

import { PrismaClient } from '@prisma/client';

interface GeocodingResult {
  lat: number;
  lng: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name?: string;
}

// Кеш для rate limiting (1 запрос в секунду)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 секунда

/**
 * Геокодинг адреса через Nominatim API
 * @param address - адрес для геокодинга
 * @returns координаты {lat, lng} или null если не найдено
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  try {
    // Соблюдаем rate limit (1 запрос в секунду)
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => global.setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    // Формируем URL для Nominatim API
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1`;

    // Делаем запрос с User-Agent (требуется Nominatim)
    const response = await global.fetch(url, {
      headers: {
        'User-Agent':
          'CRM-Beauty-Backend/1.0 (contact: your-email@example.com)', // Замените на ваш email
      },
    });

    if (!response.ok) {
      console.error(
        `[GEOCODING] Nominatim API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as NominatimResponse[];

    if (!data || data.length === 0) {
      console.log(`[GEOCODING] Address not found: ${address}`);
      return null;
    }

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lng)) {
      console.error(
        `[GEOCODING] Invalid coordinates: ${result.lat}, ${result.lon}`
      );
      return null;
    }

    console.log(
      `[GEOCODING] Successfully geocoded: ${address} -> (${lat}, ${lng})`
    );

    return { lat, lng };
  } catch (error) {
    console.error(`[GEOCODING] Error geocoding address "${address}":`, error);
    return null;
  }
}

/**
 * Геокодинг адреса с кешированием в БД
 * Если координаты уже есть в БД - возвращаем их
 * Если нет - делаем запрос к Nominatim и сохраняем в БД
 *
 * @param prisma - экземпляр PrismaClient
 * @param userId - ID пользователя
 * @param address - адрес для геокодинга
 * @returns координаты {lat, lng} или null
 */
export async function geocodeAndCache(
  prisma: PrismaClient,
  userId: string,
  address: string | null | undefined
): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  // Проверяем, есть ли уже координаты в БД
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lat: true, lng: true, address: true },
  });

  // Если координаты уже есть и адрес не изменился - возвращаем их
  if (user?.lat && user?.lng && user?.address === address) {
    return {
      lat: Number(user.lat),
      lng: Number(user.lng),
    };
  }

  // Если адрес изменился или координат нет - делаем геокодинг
  const coordinates = await geocodeAddress(address);

  if (coordinates) {
    // Сохраняем координаты в БД
    await prisma.user.update({
      where: { id: userId },
      data: {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
    });
  }

  return coordinates;
}
