# Meal Assistant Mobile - Setup and Configuration Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo Go app on your mobile device (iOS/Android)
- Backend API running on http://localhost:3001

### Installation

```bash
# Navigate to mobile directory
cd src/mobile

# Install dependencies
npm install

# Generate placeholder assets (if not already present)
node scripts/generate-assets.js
```

### Starting the App

```bash
# Start Expo development server
npm start
# or
npx expo start

# For specific platforms:
npm run web      # Web browser
npm run android  # Android (Expo Go or emulator)
npm run ios      # iOS (Expo Go or simulator)
```

## Accessing via Expo Go

1. Install Expo Go on your mobile device from App Store or Google Play
2. Run `npm start` in the mobile directory
3. Scan the QR code with:
   - iOS: Camera app
   - Android: Expo Go app scanner
4. The app will load on your device

### Tunnel Mode (For Remote Access)

If your mobile device cannot reach localhost:

```bash
npx expo start --tunnel
```

This creates a public tunnel URL accessible from any network.

## Web Access

```bash
npm run web
```

Opens the app at http://localhost:8081 (or next available port).

## Configuration

### Environment Variables (.env)

Key configuration options in `/src/mobile/.env`:

```env
# API URL - Update for your backend
EXPO_PUBLIC_API_URL=http://localhost:3001/api

# Timeout settings
EXPO_PUBLIC_API_TIMEOUT=30000
EXPO_PUBLIC_MAX_RETRIES=3

# Feature flags
EXPO_PUBLIC_FEATURE_OFFLINE_MODE=true
EXPO_PUBLIC_DEBUG_MODE=false
```

### Network Configuration for Mobile Devices

When testing with Expo Go on a physical device:

1. **Same Network**: Device must be on the same WiFi as your development machine
2. **Firewall**: Allow incoming connections on ports 8081 and 19000-19002
3. **API URL**: Use your machine's local IP instead of localhost:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.xxx:3001/api
   ```

Find your local IP:
- Windows: `ipconfig`
- Mac/Linux: `ifconfig` or `ip addr`

## Project Structure

```
src/mobile/
├── App.tsx                 # Root component
├── index.js               # Entry point
├── app.json               # Expo configuration
├── .env                   # Environment variables
├── metro.config.js        # Metro bundler config
├── babel.config.js        # Babel configuration
├── tsconfig.json          # TypeScript config
├── assets/                # App icons, splash screen
├── components/            # Reusable UI components
├── navigation/            # React Navigation setup
├── screens/               # Screen components
├── services/              # API and sync services
├── store/                 # Redux store and slices
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions and theme
```

## Troubleshooting

### Common Issues

#### 1. "Unable to resolve module" errors

```bash
# Clear Metro bundler cache
npx expo start --clear

# Or reset completely
rm -rf node_modules .expo
npm install
```

#### 2. Connection to Expo Go fails

- Ensure device and computer are on same network
- Try tunnel mode: `npx expo start --tunnel`
- Check firewall settings

#### 3. API calls fail from device

The device cannot reach `localhost`. Update `.env`:

```env
# Replace with your computer's IP address
EXPO_PUBLIC_API_URL=http://YOUR_IP:3001/api
```

#### 4. TypeScript errors

```bash
# Check for type errors
npm run typecheck
```

#### 5. Metro bundler stuck

```bash
# Kill Metro and restart
npx expo start --clear
```

#### 6. "react-native-reanimated" issues

Ensure `babel.config.js` has the reanimated plugin listed **last**:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};
```

### Debug Commands

```bash
# Check Expo version
npx expo --version

# Verify configuration
npx expo-doctor

# View logs
npx expo start --dev-client

# Test specific platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

## Development Workflow

1. Start backend API: `npm run dev` (from root)
2. Start mobile app: `npm start` (from src/mobile)
3. Open Expo Go on device and scan QR
4. Make changes - hot reload will update automatically

## Building for Production

```bash
# Build for iOS (requires Apple Developer account)
npx expo build:ios

# Build for Android
npx expo build:android

# Build for web
npx expo export:web
```

## Dependencies

Key packages in this project:

- **expo ~50.0.0**: Core Expo SDK
- **react-native 0.73.0**: React Native framework
- **@react-navigation/***: Navigation system
- **@reduxjs/toolkit**: State management
- **redux-persist**: Persistent storage
- **react-native-reanimated**: Animation library
- **react-native-gesture-handler**: Touch gestures
