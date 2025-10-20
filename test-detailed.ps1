# Детальный тест API с логированием

Write-Host "=== Детальное тестирование API booking ==="

# Получаем реальный serviceId
Write-Host "1. Получение данных мастера..."
$masterData = Invoke-RestMethod -Uri "http://localhost:3000/api/public/anna-krasotkina"
$serviceId = $masterData.services[0].id
Write-Host "Найден serviceId: $serviceId"

# Тест с реальным serviceId
Write-Host "`n2. Тест с реальным serviceId..."
$body = @{
    name = "Тест Клиент"
    phone = "+7-999-123-45-67"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"
    comment = "Тестовая запись"
} | ConvertTo-Json

Write-Host "Отправляемые данные:"
Write-Host $body

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✅ Успех! Статус: $($response.StatusCode)"
    Write-Host "Ответ: $($response.Content)"
} catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Статус: $($_.Exception.Response.StatusCode)"
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Тело ответа: $responseBody"
    }
}

Write-Host "`n=== Тест завершен ==="
Write-Host "Проверьте логи бэкенда для детальной информации"
