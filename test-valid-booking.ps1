# Test with valid data that should pass validation

Write-Host "=== Testing with valid data ==="

# Create JSON string manually to avoid PowerShell parsing
$validJson = '{"name":"Test Client","phone":"+7-999-123-45-67","serviceId":"cmgzq0xsg0003t5dwfrmy19cz","startAt":"2024-12-25T10:00:00.000Z","comment":"Test booking"}'

Write-Host "Sending valid JSON:"
Write-Host $validJson

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $validJson
    Write-Host "SUCCESS - Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "ERROR - Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Error: $($_.Exception.Message)"
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody"
    }
}

Write-Host "`nCheck the backend console for detailed logs!"
