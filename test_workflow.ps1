# EOB Workflow Quick Test Script
# Run this after importing the workflow in n8n

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "EOB Simplified Workflow Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Check if backend is running
Write-Host "[1/4] Testing Backend Server..." -ForegroundColor Yellow
try {
    $backendTest = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/admin/openai-models/2/pricing" -Method Get -ErrorAction Stop
    if ($backendTest.success) {
        Write-Host "  ✓ Backend is running and responding" -ForegroundColor Green
        Write-Host "  Model: $($backendTest.data.model_name)" -ForegroundColor Gray
        Write-Host "  Input Cost: `$$($backendTest.data.input_cost_per_1k)/1k tokens" -ForegroundColor Gray
        Write-Host "  Output Cost: `$$($backendTest.data.output_cost_per_1k)/1k tokens`n" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Backend not responding!" -ForegroundColor Red
    Write-Host "  Please start backend: npm run dev`n" -ForegroundColor Red
    exit 1
}

# Test 2: Check DocAI config
Write-Host "[2/4] Testing DocAI Configuration..." -ForegroundColor Yellow
try {
    $docAiTest = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/admin/config/docai_cost_per_page" -Method Get -ErrorAction Stop
    if ($docAiTest.success) {
        Write-Host "  ✓ DocAI config loaded" -ForegroundColor Green
        Write-Host "  Cost per page: `$$($docAiTest.data.value)`n" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ DocAI config not found!`n" -ForegroundColor Red
    exit 1
}

# Test 3: Trigger webhook
Write-Host "[3/4] Triggering Webhook..." -ForegroundColor Yellow
$testProcessId = Get-Random -Minimum 9000 -Maximum 9999
$webhookBody = @{
    processId = $testProcessId
    modelId = 2
    filename = "test_script.pdf"
    originalFilename = "test_script.pdf"
} | ConvertTo-Json

try {
    $webhookResponse = Invoke-RestMethod -Uri "http://localhost:5678/webhook/eob-simple" -Method Post -Body $webhookBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "  ✓ Webhook triggered successfully!" -ForegroundColor Green
    Write-Host "  Process ID: $testProcessId" -ForegroundColor Gray
    Write-Host "  Response: $($webhookResponse.message)`n" -ForegroundColor Gray

    Write-Host "  ⏱️  Waiting 5 seconds for workflow to complete..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "  ✗ Webhook not registered!" -ForegroundColor Red
        Write-Host "  Please import and ACTIVATE the workflow in n8n" -ForegroundColor Red
        Write-Host "  File: C:\n8ndata\eob-extraction-final\n8n-workflows\EOB_Simplified_Working_Webhook.json`n" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "  ✗ Webhook error: $($_.Exception.Message)`n" -ForegroundColor Red
        exit 1
    }
}

# Test 4: Check database (requires MySQL client)
Write-Host "[4/4] Checking Database..." -ForegroundColor Yellow
Write-Host "  Run this SQL query to verify:" -ForegroundColor Gray
Write-Host "  SELECT * FROM document_processed WHERE process_id = $testProcessId;`n" -ForegroundColor Cyan

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Backend: WORKING" -ForegroundColor Green
Write-Host "✓ Pricing APIs: WORKING" -ForegroundColor Green
Write-Host "✓ Webhook: TRIGGERED" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Check n8n executions: http://localhost:5678/executions" -ForegroundColor White
Write-Host "2. Verify all 9 nodes show green checkmarks" -ForegroundColor White
Write-Host "3. Check database for process_id = $testProcessId" -ForegroundColor White
Write-Host "4. Expected costs: DocAI=`$0.15, OpenAI=~`$0.0013, Total=~`$0.1513`n" -ForegroundColor White

Write-Host "For detailed guide, see: READY_TO_TEST_REPORT.md`n" -ForegroundColor Gray
