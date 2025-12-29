import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { InventoryScreen } from './InventoryScreen';
import { PrepScreen } from './PrepScreen';
import { ShoppingScreen } from './ShoppingScreen';
import { colors, typography, spacing } from '../utils/theme';

const TopTab = createMaterialTopTabNavigator();

export const KitchenScreen: React.FC = () => {
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
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarLabel: 'Inventory',
        }}
      />
      <TopTab.Screen
        name="Prep"
        component={PrepScreen}
        options={{
          tabBarLabel: 'Prep',
        }}
      />
      <TopTab.Screen
        name="Shopping"
        component={ShoppingScreen}
        options={{
          tabBarLabel: 'Shopping',
        }}
      />
    </TopTab.Navigator>
  );
};
