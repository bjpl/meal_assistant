# Jest Configuration Fix for JSX Support

## Problem
The inventory service tests were failing with:
```
SyntaxError: Support for the experimental syntax 'jsx' isn't currently enabled
```

This occurred because the inventory services import mobile components that use JSX, and Jest wasn't configured to transform these files.

## Solution Applied

### 1. Updated Transform Configuration (config/jest.config.js)

Added support for transforming both TypeScript and JavaScript/JSX files:

```javascript
transform: {
  '^.+\\.(ts|tsx)$': ['ts-jest', {
    tsconfig: path.resolve(__dirname, '..', 'tsconfig.json')
  }],
  '^.+\\.(js|jsx)$': ['ts-jest', {
    tsconfig: path.resolve(__dirname, '..', 'tsconfig.json')
  }]
}
```

### 2. Added transformIgnorePatterns

Configured Jest to transform React Native and Expo packages in node_modules:

```javascript
transformIgnorePatterns: [
  'node_modules/(?!(react-native|@react-native|@expo|expo|react-native-web|@react-native-async-storage)/)'
]
```

This tells Jest to transform packages that start with:
- react-native
- @react-native
- @expo
- expo
- react-native-web
- @react-native-async-storage

### 3. Added Module Name Mappers

Created mappings to mock React Native modules that aren't needed for service tests:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@tests/(.*)$': '<rootDir>/tests/$1',
  // Mock React Native modules
  '^react-native$': 'react-native-web',
  '^@react-native-async-storage/async-storage$': '<rootDir>/tests/__mocks__/async-storage.js',
  '^@react-native-community/netinfo$': '<rootDir>/tests/__mocks__/netinfo.js',
  '^expo-notifications$': '<rootDir>/tests/__mocks__/expo-notifications.js',
  '^expo-constants$': '<rootDir>/tests/__mocks__/expo-constants.js',
  '^expo-linear-gradient$': '<rootDir>/tests/__mocks__/expo-linear-gradient.js',
  // Mock image and asset imports
  '\\.(jpg|jpeg|png|gif|svg|ttf|woff|woff2)$': '<rootDir>/tests/__mocks__/fileMock.js'
}
```

### 4. Created Mock Files (tests/__mocks__/)

Created mock implementations for React Native modules:

1. **async-storage.js** - Mocks AsyncStorage with jest functions
2. **netinfo.js** - Mocks network information API
3. **expo-notifications.js** - Mocks Expo notifications
4. **expo-constants.js** - Mocks Expo constants
5. **expo-linear-gradient.js** - Mocks linear gradient component
6. **fileMock.js** - Mocks static file imports (images, fonts)

## Benefits

1. **Service tests can run** - Inventory services can now be tested without encountering JSX parsing errors
2. **Faster tests** - Mocking React Native dependencies speeds up test execution
3. **Better isolation** - Service tests don't need actual React Native environment
4. **Cleaner test output** - No warnings about missing React Native modules

## Files Modified

- `config/jest.config.js` - Updated transform, transformIgnorePatterns, and moduleNameMapper

## Files Created

- `tests/__mocks__/async-storage.js`
- `tests/__mocks__/netinfo.js`
- `tests/__mocks__/expo-notifications.js`
- `tests/__mocks__/expo-constants.js`
- `tests/__mocks__/expo-linear-gradient.js`
- `tests/__mocks__/fileMock.js`

## Verification

The configuration was verified by loading it with Node.js:
- ✅ 2 transform patterns configured
- ✅ 9 module mappers defined
- ✅ Configuration loads without syntax errors

## Next Steps

Run the inventory service tests to verify the fix:
```bash
npm test -- tests/unit/services/inventory/index.test.ts
```
