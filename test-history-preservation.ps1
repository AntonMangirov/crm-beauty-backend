# Скрипт для тестирования сохранения истории клиентов
# Использование: .\test-history-preservation.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Тестирование сохранения истории клиентов ===" -ForegroundColor Cyan
Write-Host ""

# Настройки
$baseUrl = "http://localhost:3000"
$masterSlug = "test-master"  # Замените на реальный slug мастера
$testPhone = "+79991234567"

# 1. Тест создания записи с проверкой снапшотов
Write-Host "1. Тест создания записи с проверкой снапшотов" -ForegroundColor Yellow
Write-Host "   Создаем запись через API..." -ForegroundColor Gray

try {
    # Получаем информацию о мастере и услугах
    $masterResponse = Invoke-RestMethod -Uri "$baseUrl/api/public/$masterSlug" -Method Get
    $service = $masterResponse.services[0]
    
    if (-not $service) {
        Write-Host "   ОШИБКА: Нет активных услуг у мастера" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "   Найдена услуга: $($service.name), цена: $($service.price), длительность: $($service.durationMin) мин" -ForegroundColor Gray
    
    # Создаем запись
    $startAt = (Get-Date).AddDays(1).ToString("o")
    $bookingData = @{
        name = "Test Client"
        phone = $testPhone
        serviceId = $service.id
        startAt = $startAt
        source = "MANUAL"
    } | ConvertTo-Json
    
    $bookingResponse = Invoke-RestMethod -Uri "$baseUrl/api/public/$masterSlug/book" -Method Post -Body $bookingData -ContentType "application/json"
    
    Write-Host "   ✓ Запись создана: $($bookingResponse.id)" -ForegroundColor Green
    
    # Проверяем снапшоты в базе данных (через Prisma Studio или прямой запрос)
    Write-Host "   Проверьте в базе данных, что у записи заполнены поля:" -ForegroundColor Gray
    Write-Host "     - serviceName = $($service.name)" -ForegroundColor Gray
    Write-Host "     - serviceDuration = $($service.durationMin)" -ForegroundColor Gray
    Write-Host "     - servicePrice = $($service.price)" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "   ОШИБКА при создании записи: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Убедитесь, что:" -ForegroundColor Yellow
    Write-Host "     - Сервер запущен на $baseUrl" -ForegroundColor Yellow
    Write-Host "     - Мастер с slug '$masterSlug' существует" -ForegroundColor Yellow
    Write-Host "     - У мастера есть активные услуги" -ForegroundColor Yellow
    Write-Host ""
}

# 2. Тест истории с fallback при удаленном Service
Write-Host "2. Тест истории с fallback при удаленном Service" -ForegroundColor Yellow
Write-Host "   Для этого теста нужно:" -ForegroundColor Gray
Write-Host "     1. Создать запись (см. тест 1)" -ForegroundColor Gray
Write-Host "     2. Деактивировать услугу (isActive = false)" -ForegroundColor Gray
Write-Host "     3. Получить историю клиента через GET /api/me/clients/:id/history" -ForegroundColor Gray
Write-Host "     4. Проверить, что данные берутся из снапшотов" -ForegroundColor Gray
Write-Host ""

# 3. Тест защиты от удаления Service с историей
Write-Host "3. Тест защиты от удаления Service с историей" -ForegroundColor Yellow
Write-Host "   Для этого теста нужно:" -ForegroundColor Gray
Write-Host "     1. Создать запись с услугой" -ForegroundColor Gray
Write-Host "     2. Попытаться удалить услугу через DELETE /api/me/services/:id" -ForegroundColor Gray
Write-Host "     3. Проверить, что возвращается ошибка 400" -ForegroundColor Gray
Write-Host "     4. Проверить, что предлагается использовать деактивацию" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Для полного тестирования используйте:" -ForegroundColor Cyan
Write-Host "   1. npm test -- client-history-preservation.test.ts" -ForegroundColor White
Write-Host "   2. Prisma Studio для проверки данных в БД" -ForegroundColor White
Write-Host "   3. Postman/Insomnia для тестирования API" -ForegroundColor White
Write-Host ""






