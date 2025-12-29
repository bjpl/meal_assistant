# Navigation Refactoring - 7 to 5 Tabs

## Summary
Refactored the main bottom tab navigation from 7 tabs to 5 tabs for better mobile UX.

## Changes Made

### New Tab Structure
1. **Dashboard** (Home) - Unchanged
2. **Track** - Unchanged
3. **Kitchen** - NEW combined screen with top tabs for:
   - Inventory
   - Prep
   - Shopping
4. **Stats** - Combined screen with top tabs for:
   - Analytics
   - Hydration tracking
5. **More** - Settings and additional features

### Files Created
- `/screens/KitchenScreen.tsx` - Top tab navigator for kitchen-related features
- `/screens/StatsScreen.tsx` - Top tab navigator for analytics and hydration
- `/screens/MoreScreen.tsx` - Menu screen with list of additional features

### Files Modified
- `/navigation/AppNavigator.tsx` - Updated to use 5 tabs instead of 7
- `/types/index.ts` - Updated MainTabParamList type definition

### Dependencies Added
- `@react-navigation/material-top-tabs@^6.6.14`
- `react-native-tab-view`

## Navigation Structure

### Before (7 tabs)
```
- Dashboard
- Tracking
- Inventory
- PrepPlan
- Hydration
- Analytics
- Shopping
```

### After (5 tabs)
```
- Dashboard (Home)
- Tracking (Track)
- Kitchen
  └─ Inventory
  └─ Prep
  └─ Shopping
- Stats
  └─ Analytics
  └─ Hydration
- More
  └─ Settings
  └─ Social Events
  └─ Price History
  └─ Store Optimizer
```

## Benefits
1. Cleaner bottom navigation with fewer tabs
2. Grouped related features logically
3. Better mobile UX (5 tabs fits better on smaller screens)
4. Maintains access to all features through intuitive grouping

## Testing
To test the new navigation:
1. Run `npm start` to start the Expo development server
2. Verify all 5 tabs appear in the bottom navigation
3. Test navigation between tabs
4. Test top tab navigation within Kitchen and Stats screens
5. Test menu items in More screen

## Icon Changes
- Dashboard: 🏠 (Home)
- Tracking: 📷 (Track)
- Kitchen: 🍳
- Stats: 📊
- More: ☰

## Future Considerations
- The More screen can be extended with additional menu items as needed
- Top tabs can be customized further with swipe gestures if desired
- Consider adding modal screens for some features from the More menu
