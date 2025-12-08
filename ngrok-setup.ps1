# ngrok setup script for mobile testing (PowerShell)
# Run this script to start ngrok tunnel

Write-Host "🚀 Starting ngrok tunnel for mobile testing..." -ForegroundColor Green
Write-Host ""

# Check if ngrok is installed
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokPath) {
    Write-Host "❌ ngrok is not installed!" -ForegroundColor Red
    Write-Host "📥 Download from: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "💡 Or install via: npm install -g ngrok" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ ngrok found!" -ForegroundColor Green
Write-Host ""
Write-Host "Starting ngrok tunnel on port 5173..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Make sure your dev server is running on port 5173 first!" -ForegroundColor Yellow
Write-Host "   Run: npm run dev" -ForegroundColor Yellow
Write-Host ""

# Start ngrok
Start-Process ngrok -ArgumentList "http", "5173"

Write-Host ""
Write-Host "✅ ngrok tunnel started!" -ForegroundColor Green
Write-Host "📱 Copy the HTTPS URL from ngrok and use it on your mobile device" -ForegroundColor Cyan
Write-Host "   Example: https://abc123.ngrok-free.app" -ForegroundColor Gray
