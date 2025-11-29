/**
 * Mock for expo-constants
 */

const Constants = {
  manifest: {},
  expoConfig: {},
  platform: {
    ios: undefined,
    android: undefined,
    web: {}
  },
  deviceName: 'Test Device'
};

module.exports = {
  default: Constants,
  ...Constants
};
