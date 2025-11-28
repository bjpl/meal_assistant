# Meal Assistant Mobile - Comprehensive Test Plan

**Version:** 1.0.0
**Last Updated:** 2025-11-23
**Application:** meal-assistant-mobile (Expo SDK 50, React Native 0.73)

---

## Table of Contents

1. [Test Environment Setup](#1-test-environment-setup)
2. [Expo Go Testing](#2-expo-go-testing)
3. [Web Testing](#3-web-testing)
4. [API Connectivity Testing](#4-api-connectivity-testing)
5. [Configuration Validation](#5-configuration-validation)
6. [Expected vs Actual Results Template](#6-expected-vs-actual-results-template)
7. [Troubleshooting Decision Tree](#7-troubleshooting-decision-tree)
8. [Success Criteria Checklist](#8-success-criteria-checklist)

---

## 1. Test Environment Setup

### 1.1 Prerequisites

| Requirement | Minimum Version | Verification Command |
|-------------|-----------------|---------------------|
| Node.js | 18.x or 20.x | `node --version` |
| npm | 9.x+ | `npm --version` |
| Expo CLI | Latest | `npx expo --version` |
| Git | 2.x+ | `git --version` |

### 1.2 Project Setup Verification

```bash
# Navigate to mobile directory
cd /mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile

# Verify package.json exists
ls package.json

# Install dependencies
npm install

# Verify .env file exists (copy from .env.example if not)
ls .env || cp .env.example .env
```

### 1.3 Environment File Configuration

Verify `/src/mobile/.env` contains:

```env
# Required for API connectivity
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Feature flags (verify these are set)
EXPO_PUBLIC_FEATURE_OFFLINE_MODE=true
EXPO_PUBLIC_FEATURE_CACHING=true
EXPO_PUBLIC_DEBUG_MODE=true  # Enable for testing
```

---

## 2. Expo Go Testing

### 2.1 Expo Go Installation

#### iOS Device
1. Open App Store on your iOS device
2. Search for "Expo Go"
3. Install the app (publisher: 650 Industries, Inc.)
4. Verify installation by opening the app

#### Android Device
1. Open Google Play Store on your Android device
2. Search for "Expo Go"
3. Install the app (publisher: 650 Industries, Inc.)
4. Verify installation by opening the app

### 2.2 Starting the Development Server

```bash
# Terminal 1: Start Expo development server
cd /mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile
npm start
```

**Expected Output:**
```
Metro waiting on exp://192.168.x.x:8081
Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

Press 'a' to open Android emulator
Press 'i' to open iOS simulator
Press 'w' to open web
```

### 2.3 QR Code Connection Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Run `npm start` in terminal | QR code displays in terminal | |
| 2 | Open Expo Go app on device | App launches, shows "Scan QR Code" | |
| 3 | Scan QR code with device camera | Expo Go opens and starts bundling | |
| 4 | Wait for JavaScript bundle | Progress indicator shows 0-100% | |
| 5 | App loads | Splash screen appears, then main UI | |

### 2.4 Common Expo Go Failures

#### Failure: "Network request failed" or "Could not connect"

**Diagnosis Steps:**
1. Verify computer and phone are on the same WiFi network
2. Check firewall is not blocking port 8081
3. Try running with tunnel mode: `npx expo start --tunnel`

**Fix Commands:**
```bash
# Option 1: Use tunnel mode (works across networks)
npx expo start --tunnel

# Option 2: Clear Metro bundler cache
npx expo start --clear

# Option 3: Check local IP and use it directly
ipconfig # Windows
ifconfig # Mac/Linux
# Then update connection in Expo Go manually
```

#### Failure: "Unable to resolve module" or Metro bundler errors

**Diagnosis Steps:**
1. Check if the module exists in package.json
2. Verify node_modules is not corrupted
3. Check for TypeScript compilation errors

**Fix Commands:**
```bash
# Clear cache and reinstall
rm -rf node_modules
rm package-lock.json
npm install
npx expo start --clear
```

#### Failure: App crashes immediately after loading

**Diagnosis Steps:**
1. Check Metro bundler console for red error messages
2. Look for "Invariant Violation" or "null is not an object"
3. Check if all required native modules are linked

**Fix Commands:**
```bash
# Reset Expo cache
npx expo start --clear

# Verify expo modules
npx expo install --check

# Fix any mismatched versions
npx expo install --fix
```

### 2.5 Expo Go Device Compatibility Matrix

| Device Type | OS Version | Expo Go Version | Status |
|-------------|------------|-----------------|--------|
| iOS iPhone | 13.0+ | Latest | Supported |
| iOS iPad | 13.0+ | Latest | Supported |
| Android | 6.0+ (API 23+) | Latest | Supported |
| Android Tablet | 6.0+ | Latest | Supported |

---

## 3. Web Testing

### 3.1 Starting Web Version

```bash
# Start web development server
cd /mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile
npm run web
# Or: npx expo start --web
```

**Expected Output:**
```
Web Bundling complete XXXXX
Expo started on http://localhost:8081
```

### 3.2 Browser Compatibility Checks

| Browser | Minimum Version | Test URL | Expected Result |
|---------|-----------------|----------|-----------------|
| Chrome | 90+ | http://localhost:8081 | App renders correctly |
| Firefox | 88+ | http://localhost:8081 | App renders correctly |
| Safari | 14+ | http://localhost:8081 | App renders correctly |
| Edge | 90+ | http://localhost:8081 | App renders correctly |

### 3.3 Web UI Rendering Validation

#### Test Case: Initial Load
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open http://localhost:8081 in browser | Page loads without 404 | |
| 2 | Wait for bundle compilation | Loading indicator visible | |
| 3 | App renders | Either onboarding or dashboard visible | |
| 4 | No console errors | DevTools console shows no red errors | |

#### Test Case: Navigation
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Home" tab | Dashboard screen displays | |
| 2 | Click "Track" tab | Tracking screen displays | |
| 3 | Click "Inventory" tab | Inventory screen displays | |
| 4 | Click "Prep" tab | Prep screen displays | |
| 5 | Click "Water" tab | Hydration screen displays | |
| 6 | Click "Stats" tab | Analytics screen displays | |
| 7 | Click "Shop" tab | Shopping screen displays | |

#### Test Case: Responsive Layout
| Screen Width | Action | Expected Result | Pass/Fail |
|--------------|--------|-----------------|-----------|
| 375px (mobile) | Resize browser | UI adapts, no horizontal scroll | |
| 768px (tablet) | Resize browser | UI adapts appropriately | |
| 1024px+ (desktop) | Resize browser | UI centered or full-width | |

### 3.4 Web-Specific Issues

#### Issue: "window is not defined"
**Cause:** Server-side rendering attempting to access browser globals
**Fix:** Wrap browser-specific code in `useEffect` or check `typeof window !== 'undefined'`

#### Issue: Gestures not working
**Cause:** react-native-gesture-handler not configured for web
**Verification:** Check app.json has `"web": { "bundler": "metro" }`

#### Issue: SVG not rendering
**Cause:** react-native-svg web compatibility
**Fix:** Ensure victory-native chart library is compatible

---

## 4. API Connectivity Testing

### 4.1 API Configuration Verification

**File:** `/src/mobile/.env`
```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_API_TIMEOUT=30000
EXPO_PUBLIC_MAX_RETRIES=3
```

**File:** `/src/mobile/services/syncService.ts`
```typescript
// Verify API_BASE_URL is correctly configured
const API_BASE_URL = 'https://api.mealassistant.app/v1';
// OR using environment variable:
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
```

### 4.2 Network Connectivity Tests

#### Test Case: API Health Check
```bash
# Test if API server is reachable
curl -I http://localhost:3000/api/health
# Expected: HTTP 200 OK

# Test with verbose output
curl -v http://localhost:3000/api/health
```

| Endpoint | Method | Expected Status | Expected Response |
|----------|--------|-----------------|-------------------|
| /api/health | GET | 200 | `{ "status": "ok" }` |
| /api/meals | GET | 200 or 401 | Meals array or auth error |
| /api/inventory | GET | 200 or 401 | Inventory array or auth error |

### 4.3 Authentication Flow Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | App launches | Auth state checked | |
| 2 | No token present | Redirect to login/onboarding | |
| 3 | Valid token present | Main app loads | |
| 4 | Token expired | Refresh token attempted | |
| 5 | Refresh fails | Redirect to login | |

### 4.4 CORS Issues Diagnosis

**Symptom:** Network errors in browser, API works in Postman

**Check Browser Console for:**
```
Access to fetch at 'http://localhost:3000/api' from origin 'http://localhost:8081'
has been blocked by CORS policy
```

**Fix (Backend):**
```javascript
// Express.js example
app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:19006'],
  credentials: true
}));
```

### 4.5 Network Timeout Scenarios

| Scenario | Timeout (ms) | Expected Behavior |
|----------|--------------|-------------------|
| Normal request | <5000 | Response received |
| Slow network | 5000-30000 | Loading indicator shown |
| Timeout | >30000 | Error message displayed |
| No network | Immediate | Offline mode activated |

#### Test Case: Offline Mode
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Disable network (airplane mode) | App detects offline status | |
| 2 | Attempt to sync | "Offline" indicator shown | |
| 3 | Create new meal entry | Data saved locally | |
| 4 | Re-enable network | Sync automatically triggered | |
| 5 | Verify sync | Local data pushed to server | |

---

## 5. Configuration Validation

### 5.1 Environment File Validation

**Test Script:**
```bash
#!/bin/bash
# Save as: scripts/validate-env.sh

ENV_FILE="$(dirname "$0")/../.env"

echo "Validating .env file..."

# Check file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found"
    exit 1
fi

# Required variables
REQUIRED_VARS=(
    "EXPO_PUBLIC_API_URL"
    "EXPO_PUBLIC_API_TIMEOUT"
)

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" "$ENV_FILE"; then
        echo "ERROR: Missing required variable: $var"
        exit 1
    fi
done

echo "SUCCESS: All required environment variables present"
```

### 5.2 Metro Bundler Validation

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Metro starts | `npx expo start` | "Metro waiting on..." |
| Bundle compiles | Scan QR or press 'w' | "Bundling complete" |
| No errors | Check terminal | No red error messages |
| Hot reload works | Edit any .tsx file | "HMR" message, UI updates |

### 5.3 Platform-Specific Build Validation

#### iOS Build Check
```bash
# Check iOS build configuration
cat app.json | grep -A5 '"ios"'

# Expected:
# "ios": {
#   "supportsTablet": true,
#   "bundleIdentifier": "com.mealassistant.app"
# }
```

#### Android Build Check
```bash
# Check Android build configuration
cat app.json | grep -A8 '"android"'

# Expected:
# "android": {
#   "adaptiveIcon": {...},
#   "package": "com.mealassistant.app"
# }
```

#### Web Build Check
```bash
# Check web build configuration
cat app.json | grep -A4 '"web"'

# Expected:
# "web": {
#   "favicon": "./assets/favicon.png",
#   "bundler": "metro"
# }
```

### 5.4 Hot Reload Functionality Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Start dev server | App running in Expo Go/web | |
| 2 | Edit `screens/DashboardScreen.tsx` | File saved | |
| 3 | Change a text string | Metro shows "HMR" | |
| 4 | Check device/browser | UI updates without full reload | |
| 5 | Undo change | UI reverts | |

### 5.5 TypeScript Validation

```bash
# Run type checking
npm run typecheck
# Expected: No errors

# Alternative
npx tsc --noEmit
```

| Error Type | Example | Resolution |
|------------|---------|------------|
| Missing type | `Property 'X' does not exist` | Add type definition |
| Wrong type | `Type 'string' not assignable to 'number'` | Fix type mismatch |
| Missing import | `Cannot find module` | Add import statement |

---

## 6. Expected vs Actual Results Template

### Test Execution Log Template

```markdown
## Test Execution Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Dev/Staging/Production]
**Device/Browser:** [Specify]
**App Version:** 1.0.0

### Test Results Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| Expo Go | | | | |
| Web | | | | |
| API | | | | |
| Config | | | | |
| **TOTAL** | | | | |

### Detailed Results

#### Test ID: [EXPO-001]
**Test Name:** QR Code Connection
**Priority:** High

| Field | Value |
|-------|-------|
| Preconditions | Expo dev server running, device on same network |
| Test Steps | 1. Scan QR code with Expo Go |
| Expected | App loads within 30 seconds |
| Actual | [FILL IN] |
| Status | Pass / Fail / Blocked |
| Notes | [Any observations] |
| Screenshots | [Attach if failure] |

---

#### Test ID: [WEB-001]
**Test Name:** Web Browser Load
**Priority:** High

| Field | Value |
|-------|-------|
| Preconditions | `npm run web` executed |
| Test Steps | 1. Open http://localhost:8081 in Chrome |
| Expected | Dashboard or onboarding screen displays |
| Actual | [FILL IN] |
| Status | Pass / Fail / Blocked |
| Notes | [Any observations] |
| Console Errors | [List any errors] |

---

#### Test ID: [API-001]
**Test Name:** API Health Check
**Priority:** Critical

| Field | Value |
|-------|-------|
| Preconditions | Backend server running |
| Test Steps | 1. `curl http://localhost:3000/api/health` |
| Expected | HTTP 200, `{"status": "ok"}` |
| Actual | [FILL IN] |
| Status | Pass / Fail / Blocked |
| Response Time | [ms] |
```

---

## 7. Troubleshooting Decision Tree

```
START: App not loading
|
+-- Is Metro bundler running?
|   |
|   +-- NO --> Run `npm start` in mobile directory
|   |
|   +-- YES --> Continue
|
+-- Are there errors in Metro terminal?
|   |
|   +-- YES --> What type of error?
|   |   |
|   |   +-- "Unable to resolve module X"
|   |   |   --> Run: npm install X
|   |   |   --> Or: npx expo install X
|   |   |
|   |   +-- "Syntax error in X.tsx"
|   |   |   --> Fix TypeScript error in file
|   |   |
|   |   +-- "Metro has encountered an error"
|   |   |   --> Run: npx expo start --clear
|   |   |   --> If persists: rm -rf node_modules && npm install
|   |   |
|   |   +-- Other
|   |       --> Check error message, search GitHub issues
|   |
|   +-- NO --> Continue
|
+-- Testing on Expo Go or Web?
    |
    +-- EXPO GO
    |   |
    |   +-- Can you scan QR code?
    |   |   |
    |   |   +-- NO --> Is QR code visible? Update Expo Go app
    |   |   |
    |   |   +-- YES --> Continue
    |   |
    |   +-- Does it say "Connecting..."?
    |   |   |
    |   |   +-- YES, stuck --> Same WiFi network?
    |   |   |   |
    |   |   |   +-- NO --> Connect to same network
    |   |   |   |
    |   |   |   +-- YES --> Try: npx expo start --tunnel
    |   |   |
    |   |   +-- NO --> Continue
    |   |
    |   +-- Does it say "Bundling..."?
    |   |   |
    |   |   +-- YES, stuck at % --> Check Metro for errors
    |   |   |
    |   |   +-- NO --> Continue
    |   |
    |   +-- Does app crash after loading?
    |       |
    |       +-- YES --> Check Metro console for error
    |       |   --> Common: Missing native module
    |       |   --> Run: npx expo install --fix
    |       |
    |       +-- NO --> App should be working!
    |
    +-- WEB
        |
        +-- Does browser show blank page?
        |   |
        |   +-- YES --> Check browser DevTools console
        |   |   --> Look for JavaScript errors
        |   |   --> Check network tab for failed requests
        |   |
        |   +-- NO --> Continue
        |
        +-- Does browser show error message?
        |   |
        |   +-- "Cannot GET /" --> Wrong URL, use localhost:8081
        |   |
        |   +-- CORS error --> Backend CORS not configured
        |   |   --> Update backend to allow localhost:8081
        |   |
        |   +-- Other --> Check browser console
        |
        +-- App renders but features broken?
            |
            +-- Check browser console for errors
            +-- Verify API is running
            +-- Test API directly with curl/Postman
```

### Quick Fix Commands Reference

```bash
# Problem: Module not found
npm install <module-name>
npx expo install <module-name>

# Problem: Cache issues
npx expo start --clear

# Problem: Dependency version mismatch
npx expo install --fix

# Problem: Corrupted node_modules
rm -rf node_modules
rm package-lock.json
npm install

# Problem: Metro bundler frozen
# Kill process and restart
pkill -f metro  # Linux/Mac
taskkill /F /IM node.exe  # Windows (careful!)
npm start

# Problem: Expo Go can't connect
npx expo start --tunnel

# Problem: TypeScript errors
npm run typecheck
# Fix errors shown

# Problem: Need to reset app state
# In Expo Go: Shake device -> "Reload"
# Or clear AsyncStorage programmatically
```

---

## 8. Success Criteria Checklist

### Pre-Release Checklist

#### Environment Setup
- [ ] Node.js version 18+ installed
- [ ] npm packages installed without errors (`npm install`)
- [ ] `.env` file exists with all required variables
- [ ] TypeScript compiles without errors (`npm run typecheck`)

#### Expo Go (Mobile)
- [ ] Metro bundler starts without errors
- [ ] QR code is scannable
- [ ] App connects within 30 seconds
- [ ] JavaScript bundle loads completely
- [ ] App displays splash screen
- [ ] App transitions to main content
- [ ] All 7 navigation tabs are accessible
- [ ] Hot reload works on code changes

#### Web Browser
- [ ] Web server starts on port 8081
- [ ] Chrome loads app without errors
- [ ] Firefox loads app without errors
- [ ] Safari loads app without errors (if Mac)
- [ ] No console errors on initial load
- [ ] Navigation between tabs works
- [ ] Responsive design works at mobile widths

#### API Connectivity
- [ ] API server is running and reachable
- [ ] Health endpoint returns 200
- [ ] No CORS errors in browser console
- [ ] Authentication flow works
- [ ] Offline mode activates when network disabled
- [ ] Data syncs when network restored

#### Configuration
- [ ] `app.json` has correct bundle identifiers
- [ ] All required environment variables set
- [ ] Metro bundler configuration valid
- [ ] Hot reload functional

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Developer | | | |
| Product Owner | | | |

---

## Appendix A: Test Data

### Sample API Responses

**Health Check:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-11-23T00:00:00.000Z"
}
```

**Meals List:**
```json
{
  "meals": [
    {
      "id": "meal-001",
      "name": "Breakfast",
      "pattern": "standard",
      "timestamp": "2025-11-23T08:00:00.000Z"
    }
  ]
}
```

### Sample Error Responses

**401 Unauthorized:**
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

**500 Server Error:**
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

---

## Appendix B: Screen Reference

| Tab | Screen Component | File Location |
|-----|------------------|---------------|
| Home | DashboardScreen | `/screens/DashboardScreen.tsx` |
| Track | TrackingScreen | `/screens/TrackingScreen.tsx` |
| Inventory | InventoryScreen | `/screens/InventoryScreen.tsx` |
| Prep | PrepScreen | `/screens/PrepScreen.tsx` |
| Water | HydrationScreen | `/screens/HydrationScreen.tsx` |
| Stats | AnalyticsScreen | `/screens/AnalyticsScreen.tsx` |
| Shop | ShoppingScreen | `/screens/ShoppingScreen.tsx` |

---

## Appendix C: Contact Information

| Issue Type | Contact | Method |
|------------|---------|--------|
| Build failures | Development Team | GitHub Issues |
| API issues | Backend Team | Slack #api-support |
| Device compatibility | QA Team | JIRA |
| Documentation | Technical Writer | Email |

---

**End of Test Plan**
