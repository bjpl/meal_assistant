#!/bin/bash
# Meal Assistant - Quick Start Script
# This script starts all necessary services

echo "🍽️  MEAL ASSISTANT - QUICK START"
echo "================================"
echo ""

# Check if services are running
echo "📊 Checking service status..."
echo ""

# Check Docker containers
if docker ps | grep -q "meal_assistant_db"; then
    echo "✅ PostgreSQL: Running"
else
    echo "❌ PostgreSQL: Not running - Starting..."
    docker-compose up -d postgres
    sleep 3
fi

if docker ps | grep -q "meal_assistant_redis"; then
    echo "✅ Redis: Running"
else
    echo "❌ Redis: Not running - Starting..."
    docker-compose up -d redis
    sleep 3
fi

# Check API server
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ API Server: Running on port 3001"
else
    echo "❌ API Server: Not running - Starting..."
    cd src/api
    NODE_ENV=development PORT=3001 node server.js > /tmp/meal-api.log 2>&1 &
    cd ../..
    sleep 3
    echo "✅ API Server: Started on port 3001"
fi

echo ""
echo "🎯 All backend services are running!"
echo ""
echo "📱 To start the mobile app:"
echo "   1. Open a new terminal"
echo "   2. cd src/mobile"
echo "   3. npm install --legacy-peer-deps  (first time only)"
echo "   4. npx expo start"
echo ""
echo "🔑 Test credentials:"
echo "   Email: brandon@example.com"
echo "   Password: password123"
echo ""
echo "Press Ctrl+C to stop services when done."
