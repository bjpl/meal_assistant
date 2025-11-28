# Meal Assistant Mobile App - Architecture Analysis

**Date:** November 23, 2025
**Status:** Blocking Issues Identified
**Target Platforms:** iOS, Android, Web (via Expo Go)

---

## 1. ARCHITECTURAL DIAGRAM

```
                            MEAL ASSISTANT MOBILE APP
                           ============================

+-----------------------------------------------------------------------------------+
|                                  ENTRY POINT                                       |
+-----------------------------------------------------------------------------------+
|  index.js/index.ts --> registerRootComponent(App) --> App.tsx                     |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                              APP WRAPPER LAYERS                                    |
+-----------------------------------------------------------------------------------+
|  +----------------------------------+                                              |
|  | GestureHandlerRootView          |  <-- react-native-gesture-handler            |
|  |   +-----------------------------+|                                              |
|  |   | SafeAreaProvider            ||  <-- react-native-safe-area-context         |
|  |   |   +------------------------+||                                              |
|  |   |   | Redux Provider         |||  <-- @reduxjs/toolkit, react-redux          |
|  |   |   |   +-------------------+|||                                              |
|  |   |   |   | PersistGate       ||||  <-- redux-persist + AsyncStorage           |
|  |   |   |   |   +---------------+||||                                             |
|  |   |   |   |   | AppContent    |||||                                             |
|  |   |   |   |   +---------------+||||                                             |
|  +---+---+---+---+----------------++++                                             |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                           NAVIGATION ROUTER                                        |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   [CONDITIONAL ROUTING based on onboarding state]                                 |
|                                                                                    |
|   if (!onboardingComplete && !userOnboardingComplete):                            |
|       +-------------------------------------------+                                |
|       | NavigationContainer [App.tsx:35-37]       |  <-- FIRST INSTANCE           |
|       |   +-------------------------------------+ |                                |
|       |   | OnboardingNavigator                 | |                                |
|       |   |   - WelcomeScreen                   | |                                |
|       |   |   - ProfileScreen                   | |                                |
|       |   |   - PatternExplorerScreen           | |                                |
|       |   |   - ScheduleScreen                  | |                                |
|       |   |   - StoresScreen                    | |                                |
|       |   |   - FirstWeekScreen                 | |                                |
|       |   +-------------------------------------+ |                                |
|       +-------------------------------------------+                                |
|                                                                                    |
|   else:                                                                            |
|       +-------------------------------------------+                                |
|       | AppNavigator                              |                                |
|       |   +-------------------------------------+ |                                |
|       |   | NavigationContainer [Line 115-137]  | |  <-- SECOND INSTANCE          |
|       |   |   +-------------------------------+ | |                                |
|       |   |   | Stack.Navigator (MainTabs)    | | |                                |
|       |   |   |   +-------------------------+ | | |                                |
|       |   |   |   | Tab.Navigator           | | | |                                |
|       |   |   |   |   - Dashboard           | | | |                                |
|       |   |   |   |   - Tracking            | | | |                                |
|       |   |   |   |   - Inventory           | | | |                                |
|       |   |   |   |   - PrepPlan            | | | |                                |
|       |   |   |   |   - Hydration           | | | |                                |
|       |   |   |   |   - Analytics           | | | |                                |
|       |   |   |   |   - Shopping            | | | |                                |
|       |   |   |   +-------------------------+ | | |                                |
|       |   |   +-------------------------------+ | |                                |
|       |   +-------------------------------------+ |                                |
|       +-------------------------------------------+                                |
|                                                                                    |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                             STATE MANAGEMENT                                       |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   +-------------+    +-------------------+    +-----------------------+            |
|   | Redux Store |<-->| Redux Persist     |<-->| AsyncStorage          |            |
|   +-------------+    +-------------------+    +-----------------------+            |
|         |                                                                          |
|   +-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+              |
|   |     |     |     |     |     |     |     |     |     |     |     |              |
|   v     v     v     v     v     v     v     v     v     v     v     v              |
| patterns meals inventory prep shopping user sync hydration analytics events onboarding
|                                                                                    |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                              SERVICES LAYER                                        |
+-----------------------------------------------------------------------------------+
|                                                                                    |
|   +---------------------------+        +---------------------------+               |
|   | syncService.ts            |        | apiService.ts             |               |
|   |   - Network listener      |        |   - HTTP client           |               |
|   |   - Offline queue         |        |   - Token management      |               |
|   |   - Periodic sync         |        |   - Request caching       |               |
|   |   - @react-native-        |        |   - Retry logic           |               |
|   |     community/netinfo     |        |   - Offline queue         |               |
|   +---------------------------+        +---------------------------+               |
|                                                                                    |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                              API ENDPOINTS                                         |
+-----------------------------------------------------------------------------------+
|   Default: http://localhost:3001/api (configurable via EXPO_PUBLIC_API_URL)       |
|   Target: https://api.mealassistant.app/v1 (hardcoded in syncService)             |
+-----------------------------------------------------------------------------------+
```

---

## 2. IDENTIFIED BLOCKING ISSUES

### CRITICAL: Duplicate NavigationContainer (P0)

**Issue:** Two `NavigationContainer` components exist in the app hierarchy:
1. **App.tsx (lines 35-37):** Wraps `OnboardingNavigator`
2. **AppNavigator.tsx (lines 115-137):** Contains its own `NavigationContainer`

**Impact:** React Navigation explicitly warns that multiple `NavigationContainer` instances cause conflicts with deep linking, state management, and can crash the app.

**Evidence:**
```typescript
// App.tsx:35-37
<NavigationContainer>
  <OnboardingNavigator />
</NavigationContainer>

// AppNavigator.tsx:115-137
<NavigationContainer>
  <Stack.Navigator>
    <Stack.Screen name="MainTabs" component={MainTabs} />
  </Stack.Navigator>
</NavigationContainer>
```

**Fix Required:** Remove `NavigationContainer` from `AppNavigator.tsx` and ensure single container at the root level in `App.tsx`.

---

### CRITICAL: Missing Asset Files (P0)

**Issue:** The `assets/` directory is empty but `app.json` references:
- `./assets/icon.png`
- `./assets/splash.png`
- `./assets/adaptive-icon.png`
- `./assets/favicon.png`

**Impact:** Expo Go will fail to load without these required assets.

**Evidence:**
```
$ ls -la assets/
total 0
drwxrwxrwx 1 brand brand 512 Nov 23 00:00 .
drwxrwxrwx 1 brand brand 512 Nov 23 14:38 ..
```

**Fix Required:** Add placeholder or actual image files to the assets directory.

---

### CRITICAL: Duplicate Entry Points (P1)

**Issue:** Both `index.js` and `index.ts` exist with identical content.

**Impact:** Potential build confusion. `package.json` specifies `"main": "index.js"`, but TypeScript compilation may create conflicts.

**Evidence:**
```json
// package.json
"main": "index.js"
```

Both files contain identical code. The `.ts` version is redundant.

**Fix Required:** Remove `index.ts` or ensure only one entry point exists.

---

### HIGH: Missing Babel Configuration (P1)

**Issue:** No `babel.config.js` found in the mobile directory.

**Impact:** Required for proper Metro bundler operation with Expo SDK 50. May cause issues with:
- react-native-reanimated plugin
- TypeScript transformation
- Module resolution

**Fix Required:** Create `babel.config.js`:
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

---

### HIGH: Missing Metro Configuration (P1)

**Issue:** No `metro.config.js` found.

**Impact:** Default Metro configuration may not handle all dependencies correctly, especially for web platform.

**Fix Required:** Create `metro.config.js`:
```javascript
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

---

### MEDIUM: API Endpoint Mismatch (P2)

**Issue:** Two different API base URLs configured:
1. **apiService.ts:** `http://localhost:3001/api` (env configurable)
2. **syncService.ts:** `https://api.mealassistant.app/v1` (hardcoded)

**Impact:** Inconsistent API calls during development vs production.

**Fix Required:** Unify API URL configuration through environment variables only.

---

### MEDIUM: react-native-voice Compatibility (P2)

**Issue:** `react-native-voice@0.3.0` is a native module requiring native code setup.

**Impact:** May not work in Expo Go without prebuild or EAS. This package typically requires:
- iOS: CocoaPods linking
- Android: Native module linking

**Fix Required:** Either:
1. Use EAS Build for native modules
2. Replace with Expo-compatible alternative
3. Run prebuild: `npx expo prebuild`

---

### MEDIUM: expo-barcode-scanner Deprecation (P2)

**Issue:** `expo-barcode-scanner` is deprecated in Expo SDK 50.

**Impact:** Should migrate to `expo-camera` barcode scanning.

**Fix Required:** Replace with `expo-camera` BarCodeScanner.

---

## 3. DEPENDENCY TREE ANALYSIS

### Core Dependencies (Verified Working)
```
expo@50.0.21
react@18.2.0
react-native@0.73.0
@react-navigation/native@6.1.18
@react-navigation/native-stack@6.9.17 (installed: 6.11.0)
@react-navigation/bottom-tabs@6.5.11 (installed: 6.6.1)
@reduxjs/toolkit@2.10.1 (declared: ^2.0.1)
react-redux@9.2.0 (declared: ^9.0.4)
redux-persist@6.0.0
```

### Potential Issues
| Package | Declared | Installed | Status |
|---------|----------|-----------|--------|
| @babel/runtime | ^7.28.4 | Not found | WARNING |
| react-native-voice | ^0.3.0 | 0.3.0 | Native module - Expo Go incompatible |
| expo-barcode-scanner | ~12.9.0 | 12.9.3 | DEPRECATED |

### Web Platform Compatibility
| Package | Web Support |
|---------|-------------|
| expo | YES |
| react-native-gesture-handler | YES (with polyfill) |
| react-native-reanimated | PARTIAL |
| @react-native-async-storage/async-storage | YES |
| @react-native-community/netinfo | YES |
| react-native-screens | YES |
| victory-native | NO - requires SVG polyfill |
| react-native-voice | NO |
| expo-camera | PARTIAL |
| expo-barcode-scanner | NO |

---

## 4. RECOMMENDED CHANGES FOR EXPO COMPATIBILITY

### Immediate Fixes (Required for app to run)

#### 1. Fix Navigation Container Duplication

**File:** `/mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile/App.tsx`

Change NavigationRouter to:
```typescript
const NavigationRouter: React.FC = () => {
  const onboardingComplete = useSelector(
    (state: RootState) => state.onboarding?.completed ?? false
  );
  const userOnboardingComplete = useSelector(
    (state: RootState) => state.user?.onboardingComplete ?? false
  );

  const showOnboarding = !onboardingComplete && !userOnboardingComplete;

  return (
    <NavigationContainer>
      {showOnboarding ? <OnboardingNavigator /> : <MainNavigator />}
    </NavigationContainer>
  );
};
```

**File:** `/mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile/navigation/AppNavigator.tsx`

Remove NavigationContainer wrapper:
```typescript
export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
    </Stack.Navigator>
  );
};
```

#### 2. Create Required Asset Files

```bash
# In the mobile directory:
cd assets
# Create placeholder images (1024x1024 for icon, 1284x2778 for splash)
# Or use placeholder generator
```

#### 3. Create Babel Configuration

**File:** `/mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile/babel.config.js`

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

#### 4. Create Metro Configuration

**File:** `/mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile/metro.config.js`

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add web support
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');

module.exports = config;
```

#### 5. Remove Duplicate Entry Point

```bash
rm index.ts
```

### Secondary Fixes (Recommended)

#### 6. Unify API Configuration

**File:** `/mnt/c/Users/brand/Development/Project_Workspace/active-development/meal_assistant/src/mobile/services/syncService.ts`

```typescript
// Change from hardcoded:
const API_BASE_URL = 'https://api.mealassistant.app/v1';

// To environment variable:
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
```

#### 7. Handle react-native-voice

Option A: Remove if not essential
```bash
npm uninstall react-native-voice
```

Option B: Use Expo prebuild
```bash
npx expo prebuild
```

---

## 5. NETWORK/API CONNECTIVITY ARCHITECTURE

```
+------------------+     +------------------+     +------------------+
|   Mobile App     |     |   API Gateway    |     |   Backend API    |
|                  |     |                  |     |                  |
|  +------------+  |     |                  |     |  +------------+  |
|  | apiService |--+---->| Rate Limiting    |---->|  | /auth      |  |
|  +------------+  |     | Authentication   |     |  | /patterns  |  |
|        |         |     | Load Balancing   |     |  | /meals     |  |
|        v         |     +------------------+     |  | /inventory |  |
|  +------------+  |                              |  | /hydration |  |
|  | Caching    |  |                              |  | /analytics |  |
|  | (In-memory)|  |                              |  | /shopping  |  |
|  +------------+  |                              |  | /prep      |  |
|        |         |                              |  | /ads       |  |
|        v         |                              |  | /events    |  |
|  +------------+  |                              |  +------------+  |
|  | Offline    |  |                              +------------------+
|  | Queue      |  |
|  +------------+  |
|        |         |
|        v         |
|  +------------+  |
|  | AsyncStorage|  |
|  +------------+  |
+------------------+

API Features:
- Request deduplication (prevents duplicate GET requests)
- Automatic token refresh (handles 401 + TOKEN_EXPIRED)
- Exponential backoff retry (2^n seconds, max 30s, 3 retries)
- Request timeout (30s default)
- Offline queue (persisted to AsyncStorage)
- In-memory cache (5 min TTL)
- Network status monitoring (via @react-native-community/netinfo)
```

### Authentication Flow
```
1. User Login/Register
       |
       v
2. Receive accessToken + refreshToken
       |
       v
3. Store tokens in AsyncStorage
       |
       v
4. Attach accessToken to all requests
       |
       v
5. On 401 + TOKEN_EXPIRED:
   - Queue subsequent requests
   - Call /auth/refresh with refreshToken
   - Update stored tokens
   - Replay queued requests
       |
       v
6. On refresh failure:
   - Clear all tokens
   - Navigate to login
```

### Offline Handling
```
1. Network goes offline (NetInfo listener)
       |
       v
2. Write requests queued to offlineQueue
       |
       v
3. Read requests return cached data or error
       |
       v
4. Network restored
       |
       v
5. Process offline queue automatically
       |
       v
6. Update sync state in Redux
```

---

## 6. SUMMARY OF ACTION ITEMS

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Fix duplicate NavigationContainer | 30 min | App crashes |
| P0 | Add missing asset files | 15 min | Build failure |
| P1 | Create babel.config.js | 5 min | Bundle errors |
| P1 | Create metro.config.js | 5 min | Build issues |
| P1 | Remove duplicate index.ts | 1 min | Build confusion |
| P2 | Unify API URLs | 10 min | API inconsistency |
| P2 | Handle react-native-voice | 15 min | Expo Go compat |
| P2 | Replace deprecated barcode scanner | 30 min | Future-proofing |

**Estimated Total Fix Time:** 2-3 hours

---

## 7. VERIFICATION STEPS

After implementing fixes, verify with:

```bash
# 1. Clear caches
rm -rf node_modules/.cache
npx expo start --clear

# 2. Test in Expo Go
npx expo start

# 3. Test web
npx expo start --web

# 4. Verify TypeScript
npm run typecheck

# 5. Check for navigation issues
# Look for warnings about multiple NavigationContainers
```

---

*Analysis completed by System Architecture Agent*
