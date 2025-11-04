# Тест API /public/:slug/book

Write-Host "=== Тестирование API booking ==="

# 1. Тест корректного запроса
Write-Host "1. Тест корректного запроса..."
$body = @{
    name = "Тест Клиент"
    phone = "+7-999-123-45-67"
    serviceId = "cmgzq0xsg0001t5dw6x5yeicj"
    startAt = "2024-12-25T10:00:00.000Z"
    comment = "Тестовая запись"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✅ Статус: $($response.StatusCode)"
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
