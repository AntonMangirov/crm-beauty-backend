# Fixed booking API test

Write-Host "=== Fixed Booking API Test ==="

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
$correctBookingJson = @"
{
    "name": "Test Client",
    "phone": "+7-999-123-45-67",
    "serviceId": "$serviceId",
    "startAt": "2024-12-25T10:00:00.000Z",
    "comment": "Test booking"
}
"@

Write-Host "Sending JSON:"
Write-Host $correctBookingJson

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $correctBookingJson
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
$invalidServiceJson = @"
{
    "name": "Test Client",
    "phone": "+7-999-123-45-67",
    "serviceId": "invalid-service-id",
    "startAt": "2024-12-25T11:00:00.000Z",
    "comment": "Test with invalid service"
}
"@

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $invalidServiceJson
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
$conflictJson = @"
{
    "name": "Test Client 2",
    "phone": "+7-999-987-65-43",
    "serviceId": "$serviceId",
    "startAt": "2024-12-25T10:00:00.000Z",
    "comment": "Test time conflict"
}
"@

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/public/anna-krasotkina/book" -Method POST -ContentType "application/json" -Body $conflictJson
    Write-Host "UNEXPECTED SUCCESS - Status: $($response.StatusCode)"
} catch {
    Write-Host "EXPECTED ERROR - Status: $($_.Exception.Response.StatusCode)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response body: $responseBody"
}

Write-Host "`n=== Testing completed ==="
