#!/bin/bash
# ngrok setup script for mobile testing

echo "🚀 Starting ngrok tunnel for mobile testing..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed!"
    echo "📥 Download from: https://ngrok.com/download"
    echo "💡 Or install via: npm install -g ngrok"
    exit 1
fi

# Get your ngrok URL
echo "✅ ngrok found!"
echo ""
echo "Starting ngrok tunnel on port 5173..."
echo ""

# Start ngrok
ngrok http 5173 --log=stdout

