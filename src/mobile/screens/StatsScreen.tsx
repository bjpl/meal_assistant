import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { AnalyticsScreen } from './AnalyticsScreen';
import { HydrationScreen } from './HydrationScreen';
import { colors, typography } from '../utils/theme';

const TopTab = createMaterialTopTabNavigator();

export const StatsScreen: React.FC = () => {
  return (
    <TopTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary.main,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarIndicatorStyle: {
          backgroundColor: colors.primary.main,
          height: 3,
        },
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.light,
        },
        tabBarLabelStyle: {
          ...typography.body2,
          fontWeight: '600',
          textTransform: 'none',
        },
        tabBarPressColor: colors.primary.light + '20',
      }}
    >
      <TopTab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Stats',
        }}
      />
      <TopTab.Screen
        name="Hydration"
        component={HydrationScreen}
        options={{
          tabBarLabel: 'Hydration',
        }}
      />
    </TopTab.Navigator>
  );
};
