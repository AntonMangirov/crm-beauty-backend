# Тестирование API /public/:slug/book на 3 кейсах

Write-Host "=== Тестирование API booking ===" -ForegroundColor Green

# Получаем данные мастера для получения правильного serviceId
Write-Host "`n1. Получение данных мастера..." -ForegroundColor Yellow
try {
    $masterData = Invoke-RestMethod -Uri "http://localhost:3000/api/public/anna-krasotkina"
    $serviceId = $masterData.services[0].id
    Write-Host "✅ Мастер найден: $($masterData.name)" -ForegroundColor Green
    Write-Host "✅ ServiceId: $serviceId" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка получения данных мастера: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Кейс 1: Корректная запись (должен вернуть 201)
Write-Host "`n2. Кейс 1: Корректная запись..." -ForegroundColor Yellow
$correctBooking = @{
    name = "Тест Клиент"
    phone = "+7-999-123-45-67"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"
    comment = "Тестовая запись"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $correctBooking
    Write-Host "✅ Корректная запись - Статус: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✅ Ответ: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Корректная запись - Статус: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "❌ Тело ответа: $responseBody" -ForegroundColor Red
}

# Кейс 2: Неверный serviceId (должен вернуть 400)
Write-Host "`n3. Кейс 2: Неверный serviceId..." -ForegroundColor Yellow
$invalidServiceBooking = @{
    name = "Тест Клиент"
    phone = "+7-999-123-45-67"
    serviceId = "invalid-service-id"
    startAt = "2024-12-25T11:00:00.000Z"
    comment = "Тест с неверным serviceId"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $invalidServiceBooking
    Write-Host "❌ Неожиданный успех - Статус: $($response.StatusCode)" -ForegroundColor Red
} catch {
    Write-Host "✅ Неверный serviceId - Статус: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "✅ Тело ответа: $responseBody" -ForegroundColor Green
}

# Кейс 3: Пересечение времени (должен вернуть 409)
Write-Host "`n4. Кейс 3: Пересечение времени..." -ForegroundColor Yellow
$conflictBooking = @{
    name = "Тест Клиент 2"
    phone = "+7-999-987-65-43"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"  # То же время, что и в первом кейсе
    comment = "Тест конфликта времени"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $conflictBooking
    Write-Host "❌ Неожиданный успех - Статус: $($response.StatusCode)" -ForegroundColor Red
} catch {
    Write-Host "✅ Конфликт времени - Статус: $($_.Exception.Response.StatusCode)" -ForegroundColor Green
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "✅ Тело ответа: $responseBody" -ForegroundColor Green
}

Write-Host "`n=== Тестирование завершено ===" -ForegroundColor Green
Write-Host "Проверьте логи бэкенда для детальной информации" -ForegroundColor Cyan
