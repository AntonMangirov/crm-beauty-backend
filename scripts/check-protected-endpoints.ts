/**
 * Скрипт для проверки всех защищённых эндпоинтов
 * 
 * Использование:
 *   ts-node scripts/check-protected-endpoints.ts
 * 
 * Требует:
 *   - Запущенный backend сервер на http://localhost:3000
 *   - Валидные учетные данные пользователя
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL';
  message: string;
  statusCode?: number;
}

const results: TestResult[] = [];

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  requiresAuth: boolean,
  token?: string,
  data?: any
): Promise<TestResult> {
  try {
    const config: any = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Не выбрасывать ошибки
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);

    if (requiresAuth) {
      if (response.status === 401) {
        return {
          endpoint,
          method,
          status: 'PASS',
          message: 'Correctly requires authentication',
          statusCode: response.status,
        };
      } else if (token && response.status !== 401) {
        return {
          endpoint,
          method,
          status: 'PASS',
          message: `Accessible with valid token (${response.status})`,
          statusCode: response.status,
        };
      } else {
        return {
          endpoint,
          method,
          status: 'FAIL',
          message: `Should require auth but got ${response.status}`,
          statusCode: response.status,
        };
      }
    } else {
      if (response.status !== 401) {
        return {
          endpoint,
          method,
          status: 'PASS',
          message: `Public endpoint (${response.status})`,
          statusCode: response.status,
        };
      } else {
        return {
          endpoint,
          method,
          status: 'FAIL',
          message: 'Should be public but requires auth',
          statusCode: response.status,
        };
      }
    }
  } catch (error: any) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      message: `Error: ${error.message}`,
    };
  }
}

async function main() {
  log('\n🔒 Проверка защищённых эндпоинтов\n', 'blue');

  // Получаем токен для тестирования
  const testEmail = process.env.TEST_EMAIL || 'anna@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'password123';

  log(`📝 Используем учетные данные: ${testEmail}`, 'yellow');

  let token: string | undefined;

  try {
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: testPassword,
    });

    token = loginResponse.data.token;
    log('✅ Успешный вход, получен токен\n', 'green');
  } catch (error: any) {
    log(
      `⚠️  Не удалось войти: ${error.message}. Тестируем без токена.\n`,
      'yellow'
    );
  }

  // Список защищённых эндпоинтов
  const protectedEndpoints = [
    { method: 'GET' as const, path: '/api/auth/me' },
    { method: 'GET' as const, path: '/api/me' },
    { method: 'GET' as const, path: '/api/me/appointments' },
    { method: 'GET' as const, path: '/api/me/clients' },
    { method: 'GET' as const, path: '/api/me/services' },
    { method: 'GET' as const, path: '/api/me/analytics' },
    { method: 'PATCH' as const, path: '/api/me/profile' },
    { method: 'GET' as const, path: '/api/services' },
    { method: 'POST' as const, path: '/api/services' },
    { method: 'GET' as const, path: '/api/users' },
  ];

  // Список публичных эндпоинтов (не должны требовать авторизацию)
  const publicEndpoints = [
    { method: 'GET' as const, path: '/api/health' },
    { method: 'GET' as const, path: '/api/db/status' },
  ];

  log('🔐 Тестирование защищённых эндпоинтов (без токена):\n', 'blue');
  for (const { method, path } of protectedEndpoints) {
    const result = await testEndpoint(method, path, true);
    results.push(result);
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    log(
      `${statusIcon} ${method.padEnd(6)} ${path.padEnd(40)} ${result.message}`,
      result.status === 'PASS' ? 'green' : 'red'
    );
  }

  if (token) {
    log('\n🔑 Тестирование защищённых эндпоинтов (с токеном):\n', 'blue');
    for (const { method, path } of protectedEndpoints) {
      const result = await testEndpoint(method, path, true, token);
      results.push(result);
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      log(
        `${statusIcon} ${method.padEnd(6)} ${path.padEnd(40)} ${result.message}`,
        result.status === 'PASS' ? 'green' : 'red'
      );
    }
  }

  log('\n🌐 Тестирование публичных эндпоинтов:\n', 'blue');
  for (const { method, path } of publicEndpoints) {
    const result = await testEndpoint(method, path, false);
    results.push(result);
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    log(
      `${statusIcon} ${method.padEnd(6)} ${path.padEnd(40)} ${result.message}`,
      result.status === 'PASS' ? 'green' : 'red'
    );
  }

  // Тестирование с невалидным токеном
  log('\n🚫 Тестирование с невалидным токеном:\n', 'blue');
  const invalidTokenTests = [
    { method: 'GET' as const, path: '/api/auth/me' },
    { method: 'GET' as const, path: '/api/me' },
  ];

  for (const { method, path } of invalidTokenTests) {
    const result = await testEndpoint(
      method,
      path,
      true,
      'invalid.token.here'
    );
    results.push(result);
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    log(
      `${statusIcon} ${method.padEnd(6)} ${path.padEnd(40)} ${result.message}`,
      result.status === 'PASS' ? 'green' : 'red'
    );
  }

  // Итоговая статистика
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  log('\n' + '='.repeat(60), 'blue');
  log(`\n📊 Итоги проверки:`, 'blue');
  log(`   Всего тестов: ${total}`, 'reset');
  log(`   ✅ Успешно: ${passed}`, 'green');
  log(`   ❌ Провалено: ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`   Процент успеха: ${((passed / total) * 100).toFixed(1)}%\n`, 'reset');

  if (failed > 0) {
    log('❌ Обнаружены проблемы с защитой эндпоинтов!\n', 'red');
    process.exit(1);
  } else {
    log('✅ Все защищённые эндпоинты работают корректно!\n', 'green');
    process.exit(0);
  }
}

main().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}\n`, 'red');
  process.exit(1);
});

