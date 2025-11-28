import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { ProfileScreen } from '../screens/onboarding/ProfileScreen';
import { PatternExplorerScreen } from '../screens/onboarding/PatternExplorerScreen';
import { ScheduleScreen } from '../screens/onboarding/ScheduleScreen';
import { StoresScreen } from '../screens/onboarding/StoresScreen';
import { FirstWeekScreen } from '../screens/onboarding/FirstWeekScreen';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Profile: undefined;
  Patterns: undefined;
  Schedule: undefined;
  Stores: undefined;
  FirstWeek: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
      initialRouteName="Welcome"
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Patterns" component={PatternExplorerScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Stores" component={StoresScreen} />
      <Stack.Screen name="FirstWeek" component={FirstWeekScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
