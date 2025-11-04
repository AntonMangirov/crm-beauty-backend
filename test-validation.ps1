# Тест для проверки валидации и логирования

Write-Host "=== Тест валидации ==="

# Тест 1: Неверный формат даты (должен вызвать ошибку валидации)
Write-Host "1. Тест с неверным форматом даты..."
$invalidDateData = '{"name":"Test","phone":"+7-999-123-45-67","serviceId":"cmgzq0xsg0003t5dwfrmy19cz","startAt":"invalid-date","comment":"Test"}'

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $invalidDateData
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

Write-Host "`n2. Тест с пустым именем..."
$emptyNameData = '{"name":"","phone":"+7-999-123-45-67","serviceId":"cmgzq0xsg0003t5dwfrmy19cz","startAt":"2024-12-25T10:00:00.000Z","comment":"Test"}'

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $emptyNameData
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

Write-Host "`nПроверьте консоль бэкенда на наличие логов [VALIDATION]"
