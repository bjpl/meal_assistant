import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';

import { store, persistor, RootState } from './store';
import { AppNavigator } from './navigation/AppNavigator';
import { OnboardingNavigator } from './navigation/OnboardingNavigator';
import { SyncService } from './services/syncService';
import { colors } from './utils/theme';

// Ignore specific warnings in development
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Non-serializable values were found in the navigation state',
]);

// Component to handle navigation based on onboarding state
const NavigationRouter: React.FC = () => {
  const onboardingComplete = useSelector(
    (state: RootState) => state.onboarding?.completed ?? false
  );
  const userOnboardingComplete = useSelector(
    (state: RootState) => state.user?.onboardingComplete ?? false
  );

  // Show onboarding if neither flag is set
  const showOnboarding = !onboardingComplete && !userOnboardingComplete;

  if (showOnboarding) {
    return (
      <NavigationContainer>
        <OnboardingNavigator />
      </NavigationContainer>
    );
  }

  return <AppNavigator />;
};

const AppContent: React.FC = () => {
  useEffect(() => {
    // Initialize network listener for offline sync
    SyncService.initialize();

    // Start periodic sync when app is active
    SyncService.startPeriodicSync();

    return () => {
      // Cleanup on unmount
      SyncService.cleanup();
      SyncService.stopPeriodicSync();
    };
  }, []);

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background.primary}
      />
      <NavigationRouter />
    </>
  );
};

const LoadingView: React.FC = () => {
  // Simple loading view while Redux Persist rehydrates
  return null;
};

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<LoadingView />} persistor={persistor}>
            <AppContent />
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
