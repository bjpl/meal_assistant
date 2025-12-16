/**
 * Mock for react-native-web
 * Provides mutable Platform.OS for testing
 */

// Mutable platform object that tests can modify
const Platform = {
  OS: 'ios',
  select: jest.fn((options) => options[Platform.OS] || options.default),
};

// Reset function for beforeEach
Platform.reset = function() {
  Platform.OS = 'ios';
};

module.exports = {
  Platform,
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => styles,
    hairlineWidth: 1,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
};
