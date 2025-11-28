# Expo SDK 50 Troubleshooting Guide

## Research Summary

This document provides a comprehensive troubleshooting guide for common issues preventing Expo apps from working with Expo Go and web access, specifically for Expo SDK 50 with React Native 0.73.

---

## Table of Contents

1. [Critical Issues Identified in This Project](#critical-issues-identified-in-this-project)
2. [Expo SDK 50 Breaking Changes](#expo-sdk-50-breaking-changes)
3. [Connection Issues Checklist](#connection-issues-checklist)
4. [WSL2-Specific Issues](#wsl2-specific-issues)
5. [Configuration Requirements](#configuration-requirements)
6. [Environment Setup Best Practices](#environment-setup-best-practices)
7. [Web Platform Issues](#web-platform-issues)
8. [Debugging Steps](#debugging-steps)

---

## Critical Issues Identified in This Project

### 1. Missing Required Configuration Files

**Problem:** The project is missing essential configuration files:

- `babel.config.js` - Required for Metro bundler to transpile JavaScript
- `metro.config.js` - Required for customizing Metro bundler behavior

**Solution:** Create these files in the project root:

**babel.config.js:**
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

**metro.config.js:**
```javascript
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
```

### 2. Empty Assets Directory

**Problem:** The `assets/` directory is empty but `app.json` references:
- `./assets/icon.png`
- `./assets/splash.png`
- `./assets/adaptive-icon.png`
- `./assets/favicon.png`

**Solution:** Create placeholder assets or valid PNG images:
- icon.png: 1024x1024px recommended
- splash.png: 1284x2778px recommended
- adaptive-icon.png: 1024x1024px with safe zone
- favicon.png: 32x32px or 48x48px

### 3. API URL Configuration Issue

**Problem:** `.env` file uses `localhost`:
```
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

**Issue:** `localhost` does not work on physical devices or emulators because they have different network contexts.

**Solution:** Use your computer's LAN IP address:
```
# For physical devices on same WiFi
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api

# For Android Emulator specifically
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api

# For iOS Simulator (can use localhost)
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. tsconfig.json Path Aliases Without Babel Support

**Problem:** `tsconfig.json` has path aliases configured but without corresponding babel plugin:
```json
{
  "paths": {
    "@/*": ["./*"],
    "@components/*": ["./components/*"]
  }
}
```

**Solution:** If using path aliases, install and configure `babel-plugin-module-resolver`:

```bash
npm install --save-dev babel-plugin-module-resolver
```

Update `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '@components': './components',
            '@screens': './screens',
            '@services': './services',
            '@store': './store',
            '@utils': './utils',
            '@types': './types',
            '@hooks': './hooks',
            '@navigation': './navigation',
          },
        },
      ],
    ],
  };
};
```

### 5. Victory Native Web Compatibility

**Problem:** `victory-native` v37 is installed but doesn't work on web platform.

**Solution:** Create platform-specific imports:

Create `utils/charts.ts`:
```typescript
export * from 'victory';
```

Create `utils/charts.native.ts`:
```typescript
export * from 'victory-native';
```

Then import from `./utils/charts` and Metro will resolve the correct file per platform.

---

## Expo SDK 50 Breaking Changes

### Key Changes from SDK 49 to 50

1. **Xcode 15 Required** - iOS development requires Xcode 15+
2. **React Native 0.73** - Bundled with this SDK version
3. **expo-router v3** - Breaking changes if using Expo Router
4. **expo-secure-store** - Now returns `null` instead of throwing for missing keys
5. **Remove metro/metro-resolver overrides** - No longer needed for expo-router

### Common Upgrade Issues

1. **setImmediate Error**
   - Error: "Property setImmediate doesn't exist"
   - Solution: Clear cache and rebuild: `npx expo start --clear`

2. **Dependency Conflicts**
   - Run `npx expo-doctor` to check compatibility
   - Update packages to versions compatible with SDK 50

3. **Babel Preset Issues**
   - Remove `expo-router/babel` from babel.config.js (deprecated in SDK 50)
   - Use only `babel-preset-expo`

---

## Connection Issues Checklist

### Cannot Connect to Development Server

1. **Same Network Check**
   - Device and development machine must be on same WiFi network
   - Verify with: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

2. **Firewall Rules**
   ```powershell
   # Windows: Allow Expo ports
   netsh advfirewall firewall add rule name="Expo" dir=in action=allow protocol=TCP localport=19000-19006
   ```

3. **Use Tunnel Mode**
   ```bash
   npx expo start --tunnel
   ```
   Note: Requires `@expo/ngrok` package

4. **SDK Version Mismatch**
   - Expo Go app version must match SDK version
   - Update Expo Go from app store if seeing version errors

5. **Clear Cache and Restart**
   ```bash
   rm -rf node_modules
   npm cache clean --force
   npm install
   watchman watch-del-all  # If watchman is installed
   npx expo start --clear
   ```

### Manual Connection Entry

If QR code doesn't work, manually enter the URL in Expo Go:
- Find URL in terminal output (e.g., `exp://192.168.1.100:19000`)
- Enter in Expo Go "Enter URL manually" option

---

## WSL2-Specific Issues

### The Core Problem

WSL2 operates on a separate virtual network from Windows, preventing devices from connecting to the Expo development server.

### Solution 1: Mirrored Networking Mode (Recommended)

Create/edit `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
networkingMode=mirrored
```

Then restart WSL:
```powershell
wsl --shutdown
```

### Solution 2: Port Forwarding

PowerShell script to forward ports:
```powershell
$wslIP = (wsl hostname -I).Trim()
$ports = @(19000, 19001, 19002, 8081)

foreach ($port in $ports) {
    netsh interface portproxy delete v4tov4 listenport=$port
    netsh interface portproxy add v4tov4 listenport=$port connectaddress=$wslIP connectport=$port
}

# Add firewall rules
foreach ($port in $ports) {
    netsh advfirewall firewall add rule name="WSL Expo $port" dir=in action=allow protocol=TCP localport=$port
}
```

**Note:** WSL2 IP changes on restart, requiring script re-run.

### Solution 3: Use Tunnel Mode

Most reliable for WSL2:
```bash
npm install @expo/ngrok
npx expo start --tunnel
```

---

## Configuration Requirements

### Required Files Checklist

| File | Required | Purpose |
|------|----------|---------|
| `app.json` | Yes | Expo configuration |
| `package.json` | Yes | Dependencies and scripts |
| `babel.config.js` | Yes | JavaScript transpilation |
| `metro.config.js` | Recommended | Metro bundler customization |
| `tsconfig.json` | If TypeScript | TypeScript configuration |
| `assets/icon.png` | Yes | App icon |
| `assets/splash.png` | Yes | Splash screen |
| `index.js` | Yes | Entry point |

### app.json Required Fields

```json
{
  "expo": {
    "name": "App Name",
    "slug": "app-slug",
    "version": "1.0.0",
    "sdkVersion": "50.0.0",
    "platforms": ["ios", "android", "web"],
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    }
  }
}
```

### Package Version Compatibility

For Expo SDK 50:
```json
{
  "expo": "~50.0.0",
  "react": "18.2.0",
  "react-native": "0.73.x",
  "react-native-gesture-handler": "~2.14.0",
  "react-native-reanimated": "~3.6.0",
  "react-native-safe-area-context": "4.8.x",
  "react-native-screens": "~3.29.0"
}
```

Run `npx expo-doctor` to verify compatibility.

---

## Environment Setup Best Practices

### .env Configuration

```bash
# API Configuration - Use IP for physical devices
# Find your IP: ipconfig (Windows) / ifconfig (Mac/Linux)
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3001/api

# Alternative: Use dynamic detection in code
# See apiConfig.ts example below

# Timeouts
EXPO_PUBLIC_API_TIMEOUT=30000

# Feature Flags
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_USE_MOCK_API=false
```

### Dynamic API URL Configuration

Create `config/apiConfig.ts`:
```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = (): string => {
  // Check for environment variable first
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Fallback based on platform
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 for localhost
      return 'http://10.0.2.2:3001/api';
    }
    // iOS simulator can use localhost
    return 'http://localhost:3001/api';
  }

  // Production URL
  return 'https://api.yourapp.com';
};

export const API_URL = getApiUrl();
```

---

## Web Platform Issues

### Metro Bundler for Web

Expo SDK 50 uses Metro for web bundling (not Webpack). Key considerations:

1. **Web-Incompatible Packages**
   - `victory-native` - Use platform-specific files
   - `react-native-voice` - Native only, needs web fallback
   - Any package with native code dependencies

2. **Platform-Specific Files**
   ```
   component.tsx        # Shared code
   component.web.tsx    # Web-specific
   component.native.tsx # Native-specific (iOS/Android)
   ```

3. **React Native Web Dependencies**
   ```bash
   # If web doesn't work, ensure these are installed
   npm install react-native-web react-dom
   ```

### Web Build Issues

1. **JSX Transformation Errors**
   - Ensure `babel-preset-expo` is properly configured
   - Run `npx expo start --web --clear`

2. **Module Resolution Errors**
   - Check metro.config.js resolver settings
   - Verify all imports use correct extensions

---

## Debugging Steps

### Step-by-Step Troubleshooting

1. **Verify Installation**
   ```bash
   npx expo-doctor
   ```

2. **Clear All Caches**
   ```bash
   rm -rf node_modules
   rm -rf .expo
   npm cache clean --force
   npm install
   npx expo start --clear
   ```

3. **Check Metro Bundler**
   - Look for errors in terminal output
   - Access `http://localhost:19000` in browser

4. **Test Connection**
   - Try web first: `npx expo start --web`
   - Then iOS simulator: `npx expo start --ios`
   - Finally physical device with tunnel: `npx expo start --tunnel`

5. **Check Network**
   ```bash
   # Find your IP
   ipconfig  # Windows
   ifconfig  # Mac/Linux

   # Verify device can reach development machine
   # On device browser, visit http://YOUR_IP:19000
   ```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Unable to resolve module" | Missing dependency | Run `npm install` |
| "Network request failed" | API URL issue | Use IP instead of localhost |
| "SDK version mismatch" | Expo Go outdated | Update Expo Go app |
| "Cannot find module 'expo/config'" | Missing expo package | Run `npm install expo` |
| "setImmediate doesn't exist" | Polyfill issue | Clear cache, rebuild |

---

## Quick Fix Commands

```bash
# Clear everything and restart
rm -rf node_modules .expo
npm cache clean --force
npm install
npx expo start --clear

# Start with tunnel (most reliable for network issues)
npx expo start --tunnel

# Start web only
npx expo start --web

# Check package compatibility
npx expo-doctor

# Update Expo packages
npx expo install --check
```

---

## Research Sources

- Expo SDK 50 Changelog: https://expo.dev/changelog/2024-01-18-sdk-50
- Expo Troubleshooting: https://docs.expo.dev/workflow/common-development-errors/
- Expo WSL Guide: https://github.com/expo/fyi/blob/main/wsl.md
- Metro Bundler Docs: https://docs.expo.dev/guides/customizing-metro/

---

*Document generated: 2025-11-23*
*Expo SDK Version: 50.0.21*
*React Native Version: 0.73.0*
