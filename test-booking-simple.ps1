# Simple booking API test

Write-Host "=== Testing booking API ==="

# Get master data
Write-Host "1. Getting master data..."
try {
    $masterData = Invoke-RestMethod -Uri "http://localhost:3000/api/public/anna-krasotkina"
    $serviceId = $masterData.services[0].id
    Write-Host "Master: $($masterData.name)"
    Write-Host "ServiceId: $serviceId"
} catch {
    Write-Host "Error getting master: $($_.Exception.Message)"
    exit 1
}

# Test 1: Correct booking (should return 201)
Write-Host "`n2. Test 1: Correct booking..."
$correctBooking = @{
    name = "Test Client"
    phone = "+7-999-123-45-67"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"
    comment = "Test booking"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $correctBooking
    Write-Host "SUCCESS - Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "ERROR - Status: $($_.Exception.Response.StatusCode)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response body: $responseBody"
}

# Test 2: Invalid serviceId (should return 400)
Write-Host "`n3. Test 2: Invalid serviceId..."
$invalidServiceBooking = @{
    name = "Test Client"
    phone = "+7-999-123-45-67"
    serviceId = "invalid-service-id"
    startAt = "2024-12-25T11:00:00.000Z"
    comment = "Test with invalid service"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $invalidServiceBooking
    Write-Host "UNEXPECTED SUCCESS - Status: $($response.StatusCode)"
} catch {
    Write-Host "EXPECTED ERROR - Status: $($_.Exception.Response.StatusCode)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response body: $responseBody"
}

# Test 3: Time conflict (should return 409)
Write-Host "`n4. Test 3: Time conflict..."
$conflictBooking = @{
    name = "Test Client 2"
    phone = "+7-999-987-65-43"
    serviceId = $serviceId
    startAt = "2024-12-25T10:00:00.000Z"  # Same time as first test
    comment = "Test time conflict"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $conflictBooking
    Write-Host "UNEXPECTED SUCCESS - Status: $($response.StatusCode)"
} catch {
    Write-Host "EXPECTED ERROR - Status: $($_.Exception.Response.StatusCode)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response body: $responseBody"
}

Write-Host "`n=== Testing completed ==="
