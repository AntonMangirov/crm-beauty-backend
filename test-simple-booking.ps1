# Simple booking test to check logging

Write-Host "=== Simple Booking Test ==="

# Test with minimal data
$minimalBooking = @"
{
    "name": "Test",
    "phone": "+7-999-123-45-67",
    "serviceId": "test-id",
    "startAt": "2024-12-25T10:00:00.000Z"
}
"@

Write-Host "Testing with minimal data..."
Write-Host $minimalBooking

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $minimalBooking
    Write-Host "SUCCESS - Status: $($response.StatusCode)"
} catch {
    Write-Host "ERROR - Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Error: $($_.Exception.Message)"
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: '$responseBody'"
        
        if ($responseBody) {
            try {
                $errorData = $responseBody | ConvertFrom-Json
                Write-Host "Parsed error:"
                Write-Host ($errorData | ConvertTo-Json -Depth 3)
            } catch {
                Write-Host "Could not parse as JSON"
            }
        }
    }
}

Write-Host "`nCheck backend console for detailed logs"
