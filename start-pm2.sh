#!/bin/bash

# Start ClaudeWS with PM2
echo "🚀 Starting ClaudeWS with PM2..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Start or restart the app
if pm2 describe claudews > /dev/null 2>&1; then
    echo "♻️  Restarting existing PM2 process..."
    pm2 restart claudews
else
    echo "📦 Starting new PM2 process..."
    pm2 start ecosystem.config.js
fi

# Save PM2 process list
pm2 save

echo "✅ ClaudeWS is running!"
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📝 View logs: pm2 logs claudews"
echo "🔍 Monitor: pm2 monit"
echo "🛑 Stop: pm2 stop claudews"
echo "🔄 Restart: pm2 restart claudews"
