# Detailed booking API test with error logging

Write-Host "=== Detailed Booking API Test ==="

# Get master data first
Write-Host "1. Getting master data..."
try {
    $masterData = Invoke-RestMethod -Uri "http://localhost:3000/api/public/anna-krasotkina"
    $serviceId = $masterData.services[0].id
    Write-Host "Master: $($masterData.name)"
    Write-Host "ServiceId: $serviceId"
    Write-Host "Services count: $($masterData.services.Count)"
} catch {
    Write-Host "Error getting master: $($_.Exception.Message)"
    exit 1
}

# Test 1: Correct booking with detailed error handling
Write-Host "`n2. Test 1: Correct booking..."
$correctBooking = @{
    name = "Test Client"
    phone = "+7-999-123-45-67"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"
    comment = "Test booking"
}

Write-Host "Sending data:"
Write-Host ($correctBooking | ConvertTo-Json -Depth 3)

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body ($correctBooking | ConvertTo-Json)
    Write-Host "SUCCESS - Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "ERROR - Status: $($_.Exception.Response.StatusCode)"
    Write-Host "Error Message: $($_.Exception.Message)"
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody"
        
        # Try to parse as JSON
        try {
            $errorJson = $responseBody | ConvertFrom-Json
            Write-Host "Parsed error:"
            Write-Host ($errorJson | ConvertTo-Json -Depth 3)
        } catch {
            Write-Host "Could not parse error as JSON"
        }
    }
}

Write-Host "`n=== Test completed ==="
Write-Host "Check backend logs for detailed information"
