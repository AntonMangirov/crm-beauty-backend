# Простой тест для проверки логирования

Write-Host "=== Простой тест ==="

# Тест 1: Неверный serviceId (должен показать логи валидации)
Write-Host "1. Тест с неверным serviceId..."
$invalidData = '{"name":"Test","phone":"+7-999-123-45-67","serviceId":"invalid-service-id","startAt":"2024-12-25T10:00:00.000Z"}'

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $invalidData
    Write-Host "SUCCESS: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "ERROR: $($_.Exception.Response.StatusCode)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Response body: '$body'"
    }
}

Write-Host "`nПроверьте консоль бэкенда на наличие логов [VALIDATION] и [BOOKING]"
