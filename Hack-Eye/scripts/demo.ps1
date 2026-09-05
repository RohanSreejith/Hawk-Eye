# SAHAYI — Demo Scenario Trigger Script
param (
    [string]$Scenario = "vehicle_proximity"
)

Write-Host "Triggering SAHAYI Demo Scenario: $Scenario" -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://127.0.0.1:8001/api/demo/trigger?scenario=$Scenario" -Method Post | ConvertTo-Json -Depth 4
