#!/bin/bash
# Meal Assistant Mobile App Launcher
# Quick start script for Expo development server

set -e

echo "=================================================="
echo "  Meal Assistant Mobile App Launcher"
echo "=================================================="
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")/src/mobile"

echo "✓ Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Running npm install..."
    npm install
    echo ""
fi

# Check if backend is running
echo "🔍 Checking backend API..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✓ Backend API is running on http://localhost:3001"
else
    echo "⚠️  Backend API not responding at http://localhost:3001"
    echo "   Please start the backend first:"
    echo "   cd src/api && npm start"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Display options
echo "=================================================="
echo "  How would you like to run the app?"
echo "=================================================="
echo ""
echo "  1) Web Browser (Fastest - Recommended)"
echo "  2) Expo Go - Tunnel Mode (Works through WSL2)"
echo "  3) Expo Go - LAN Mode (Local network only)"
echo "  4) Android Emulator"
echo "  5) iOS Simulator (macOS only)"
echo "  6) Clear cache and restart"
echo ""
read -p "Select option (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Starting web version..."
        echo "   Browser will open at http://localhost:8081"
        echo ""
        npm run web
        ;;
    2)
        echo ""
        echo "📱 Starting Expo with tunnel mode..."
        echo "   Scan QR code with Expo Go app"
        echo "   This works through firewalls and WSL2"
        echo ""
        npx expo start --tunnel
        ;;
    3)
        echo ""
        echo "📱 Starting Expo with LAN mode..."
        echo "   Scan QR code with Expo Go app"
        echo "   Device must be on same network"
        echo ""
        npm start
        ;;
    4)
        echo ""
        echo "🤖 Starting Android emulator..."
        echo "   Make sure Android Studio emulator is running"
        echo ""
        npm run android
        ;;
    5)
        echo ""
        echo "🍎 Starting iOS simulator..."
        echo "   Requires macOS with Xcode installed"
        echo ""
        npm run ios
        ;;
    6)
        echo ""
        echo "🧹 Clearing cache and restarting..."
        echo ""
        rm -rf .expo node_modules/.cache
        npx expo start --clear
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac
