/**
 * Mock for @react-native-community/netinfo
 */

const NetInfo = {
  fetch: jest.fn(() => Promise.resolve({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true
  })),
  addEventListener: jest.fn(() => jest.fn()),
  configure: jest.fn()
};

module.exports = {
  default: NetInfo,
  ...NetInfo
};
