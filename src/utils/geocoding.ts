/**
 * Утилита для геокодинга адресов через Nominatim API (OpenStreetMap)
 * Rate limit: 1 запрос в секунду (соблюдается автоматически)
 * Результаты кешируются в БД
 */

import { PrismaClient } from '@prisma/client';
import { logError } from './logger';

interface GeocodingResult {
  lat: number;
  lng: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name?: string;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

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
    // Rate limit: 1 запрос в секунду
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => global.setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;

    // Nominatim требует уникальный User-Agent с контактной информацией
    const userAgent =
      process.env.GEOCODING_USER_AGENT ||
      'CRM-Beauty-Backend/1.0 (http://localhost:3000; admin@localhost)';

    const response = await global.fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
    });

    if (!response.ok) {
      logError('Ошибка Nominatim API', undefined, {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as NominatimResponse[];

    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lng)) {
      return null;
    }

    return { lat, lng };
  } catch (error) {
    logError(`Ошибка геокодинга адреса "${address}"`, error);
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lat: true, lng: true, address: true },
  });

  if (user?.lat && user?.lng && user?.address === address) {
    return {
      lat: Number(user.lat),
      lng: Number(user.lng),
    };
  }

  const coordinates = await geocodeAddress(address);

  if (coordinates) {
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
