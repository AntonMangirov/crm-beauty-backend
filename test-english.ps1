# Test validation and logging

Write-Host "=== Validation Test ==="

# Test 1: Invalid date format
Write-Host "1. Test with invalid date format..."
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

Write-Host "`n2. Test with empty name..."
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

Write-Host "`nCheck backend console for [VALIDATION] logs"
