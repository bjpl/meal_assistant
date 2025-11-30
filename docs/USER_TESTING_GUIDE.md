# Meal Assistant - User Testing Guide

## Quick Links

| Environment | URL |
|-------------|-----|
| **Production (Web)** | https://dist-fcq9kbfpn-brandon-lamberts-projects-a9841bf5.vercel.app |
| **GitHub Repository** | https://github.com/bjpl/meal_assistant |
| **Local Development** | http://localhost:8081 |

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Onboarding Flow](#onboarding-flow)
3. [Dashboard & Daily Tracking](#dashboard--daily-tracking)
4. [Meal Logging Flow](#meal-logging-flow)
5. [Pattern Switching Flow](#pattern-switching-flow)
6. [Inventory Management](#inventory-management)
7. [Meal Prep Planning](#meal-prep-planning)
8. [Hydration Tracking](#hydration-tracking)
9. [Shopping List Flow](#shopping-list-flow)
10. [Analytics & Progress](#analytics--progress)
11. [Social Event Planning](#social-event-planning)
12. [Settings & Preferences](#settings--preferences)
13. [Test Scenarios Checklist](#test-scenarios-checklist)

---

## Getting Started

### Accessing the App

**Web Version (Recommended for Testing):**
1. Open your browser (Chrome, Safari, or Firefox recommended)
2. Navigate to: https://dist-fcq9kbfpn-brandon-lamberts-projects-a9841bf5.vercel.app
3. Allow any permission prompts (camera, notifications)

**Local Development:**
```bash
cd meal_assistant/src/mobile
npm install
npm run web
```

### Test Account Setup

The app uses local storage for data persistence. For testing:
- **No login required** - data stored locally
- **Fresh start:** Clear browser storage to reset all data
- **Sample data:** Pre-populated for demonstration

### Default Test User Profile

| Setting | Default Value |
|---------|---------------|
| Target Calories | 1,800 kcal/day |
| Target Protein | 135g/day |
| Primary Pattern | Pattern A (Traditional) |
| Starting Weight | 250 lbs |

---

## Onboarding Flow

### Overview
New users complete a 6-step onboarding to personalize their experience.

### Step-by-Step Instructions

#### Step 1: Welcome Screen
1. **Expected:** App logo and feature highlights displayed
2. **Action:** Tap "Get Started" button
3. **Verify:** Navigates to Profile screen
4. **Alternative:** Tap "Skip to Login" to bypass onboarding

#### Step 2: Profile Setup
1. **Expected:** Form for personal information
2. **Actions:**
   - Enter your name
   - Set starting weight (e.g., 250 lbs)
   - Set target weight (e.g., 200 lbs)
   - Enter height and age
   - Select activity level
3. **Verify:** "Next" button becomes active after required fields completed
4. **Action:** Tap "Next"

#### Step 3: Pattern Explorer
1. **Expected:** Grid of 7 meal patterns (A-G)
2. **Actions:**
   - Scroll through available patterns
   - Tap each pattern card to view details:
     - **Pattern A:** Traditional (3 balanced meals)
     - **Pattern B:** Reversed (Light dinner)
     - **Pattern C:** Intermittent Fasting (16:8)
     - **Pattern D:** Protein Focus
     - **Pattern E:** Platter Style
     - **Pattern F:** Grazing (6 small meals)
     - **Pattern G:** OMAD (One meal a day)
3. **Action:** Select preferred pattern
4. **Verify:** Selected pattern highlighted with checkmark
5. **Action:** Tap "Continue"

#### Step 4: Schedule Configuration
1. **Expected:** Time pickers for each meal
2. **Actions:**
   - Set breakfast time (default: 7:30 AM)
   - Set lunch time (default: 12:00 PM)
   - Set dinner time (default: 6:30 PM)
   - Toggle meal reminders ON/OFF
3. **Action:** Tap "Next"

#### Step 5: Store Preferences
1. **Expected:** List of nearby stores
2. **Actions:**
   - Select preferred shopping stores:
     - Costco
     - Safeway
     - Whole Foods
     - Walmart
     - Trader Joe's
   - Set primary store (star icon)
3. **Verify:** At least one store selected
4. **Action:** Tap "Continue"

#### Step 6: First Week Preview
1. **Expected:** Summary card showing:
   - Daily calorie target
   - Daily protein target
   - Selected pattern name
   - Week schedule preview (7 days)
   - Estimated grocery cost
2. **Actions:**
   - Review the generated plan
   - Scroll through each day's meals
3. **Action:** Tap "Start Your Journey"
4. **Verify:** Navigates to main Dashboard

---

## Dashboard & Daily Tracking

### Overview
The Dashboard is your home screen showing daily progress and quick actions.

### Step-by-Step Instructions

#### Viewing Daily Progress
1. **Navigate:** Tap "Home" tab (house icon)
2. **Expected elements:**
   - Circular progress ring (calories consumed/target)
   - Protein progress bar
   - Meal indicators (3 dots for breakfast/lunch/dinner)
   - Quick action buttons

#### Using Quick Actions
1. **Log Meal Button:**
   - Tap "Log Meal"
   - Verify: Opens meal logging screen

2. **Decision Helper Button:**
   - Tap "Decision Helper"
   - Verify: Opens decision tree modal
   - Select options based on hunger/energy levels
   - Receive meal recommendation

#### Viewing Today's Meals
1. **Scroll down** to "Today's Meals" section
2. **Expected:** Three meal cards showing:
   - Meal time
   - Allocated calories
   - Protein target
   - Completion status (checkmark if logged)
3. **Action:** Tap any meal card to log/edit

#### Quick Pattern Switch
1. **Locate:** Horizontal pattern carousel
2. **Action:** Swipe left/right to browse patterns
3. **Action:** Tap a pattern to preview switch
4. **Verify:** Pattern switch modal opens

---

## Meal Logging Flow

### Overview
Log meals with photos, components, and satisfaction ratings.

### Step-by-Step Instructions

#### Starting a Meal Log
1. **Navigate:** Tap "Tracking" tab OR "Log Meal" from Dashboard
2. **Expected:** Meal logging interface

#### Step 1: Select Meal Type
1. **Options:** Morning | Noon | Evening
2. **Action:** Tap the appropriate meal type
3. **Verify:** Meal type highlighted

#### Step 2: Capture Photo (Optional)
1. **Action:** Tap camera icon
2. **Expected:** Camera opens
3. **Action:** Take photo of meal
4. **Verify:** Photo preview displayed
5. **Alternative:** Tap "Skip Photo"

#### Step 3: Select Meal Components
1. **Expected:** List of available components grouped by category:
   - **Protein:** Chicken Breast, Salmon, Ground Beef, etc.
   - **Carbs:** Basmati Rice, Quinoa, Sweet Potato, etc.
   - **Vegetables:** Broccoli, Mixed Vegetables, Spinach, etc.
   - **Fats:** Olive Oil, Avocado, Nuts, etc.
2. **Action:** Tap checkbox next to each component eaten
3. **Verify:** Running total updates (calories, protein)

#### Step 4: Adjust Portions
1. **Action:** Tap portion slider for any selected component
2. **Options:** 1/4x | 1/2x | 1x | 1.5x | 2x
3. **Verify:** Nutrition totals recalculate

#### Step 5: Rate Satisfaction
1. **Expected:** 5-star rating system
2. **Action:** Tap stars (1-5) for meal satisfaction
3. **Verify:** Stars fill to selected level

#### Step 6: Log Energy Level
1. **Expected:** Slider (0-100)
2. **Action:** Drag slider to current energy level
3. **Labels:** Low (0-30) | Medium (31-70) | High (71-100)

#### Step 7: Track Hunger
1. **Pre-meal hunger:** Slide to hunger level before eating
2. **Post-meal hunger:** Slide to hunger level after eating
3. **Verify:** Both values displayed

#### Step 8: Add Notes (Optional)
1. **Action:** Tap notes field
2. **Enter:** Any observations about the meal
3. **Examples:** "Felt rushed", "Added extra sauce", "Restaurant meal"

#### Step 9: Save Meal
1. **Action:** Tap "Save Meal" button
2. **Verify:**
   - Success message displayed
   - Redirected to Dashboard
   - Progress updated
   - Meal indicator shows completed

---

## Pattern Switching Flow

### Overview
Change your meal pattern based on your day's needs.

### Step-by-Step Instructions

#### Initiating a Switch
1. **Navigate:** Dashboard > Pattern carousel
2. **Action:** Tap different pattern card
3. **Alternative:** Tap pattern switch icon in header

#### Step 1: Pattern Selection Modal
1. **Expected:** Full list of patterns with details:
   - Pattern letter and name
   - Meal timing overview
   - Daily calorie distribution
   - Best use case description
2. **Action:** Tap desired pattern
3. **Verify:** Pattern highlighted

#### Step 2: Preview Changes
1. **Expected:** Comparison view showing:
   - Current pattern summary
   - New pattern summary
   - Remaining meals today
   - Calorie adjustment needed
   - Protein adjustment needed
2. **Review:** Impact on today's meals

#### Step 3: Inventory Check
1. **Expected:** List of:
   - Available ingredients (green check)
   - Missing ingredients (red X)
   - Substitution suggestions
2. **Action:** Review compatibility

#### Step 4: Confirm Switch
1. **Optional:** Select reason for switching:
   - Schedule change
   - Energy needs
   - Social event
   - Just trying something new
2. **Action:** Tap "Confirm Switch"
3. **Verify:**
   - Success message
   - Dashboard updated with new pattern
   - Remaining meals recalculated

---

## Inventory Management

### Overview
Track ingredients, quantities, and expiration dates.

### Step-by-Step Instructions

#### Viewing Inventory
1. **Navigate:** Tap "Inventory" tab (box icon)
2. **Expected:** List of items organized by location:
   - Fridge
   - Freezer
   - Pantry

#### Adding New Item
1. **Action:** Tap "+" button
2. **Expected:** Add item form
3. **Fill in:**
   - Item name (e.g., "Chicken Breast")
   - Category (protein/carb/vegetable/dairy/pantry)
   - Quantity and unit (e.g., "4 lbs")
   - Location (fridge/freezer/pantry)
   - Expiry date
   - Purchase price (optional)
   - Store purchased (optional)
4. **Action:** Tap "Save"
5. **Verify:** Item appears in list

#### Barcode Scanning
1. **Action:** Tap barcode icon
2. **Expected:** Camera opens for scanning
3. **Action:** Scan product barcode
4. **Verify:** Product info auto-populates

#### Checking Expiry Status
1. **Look for indicators:**
   - **Green:** Fresh (>3 days until expiry)
   - **Yellow:** Expiring soon (1-3 days)
   - **Red:** Expired or expires today
2. **Action:** Tap item to view full details

#### Updating Quantity
1. **Action:** Tap item in list
2. **Action:** Adjust quantity slider or enter new value
3. **Action:** Tap "Update"
4. **Verify:** Quantity updated

#### Removing Item
1. **Action:** Swipe item left
2. **Action:** Tap "Delete" button
3. **Verify:** Item removed from list

---

## Meal Prep Planning

### Overview
Plan and execute meal preparation sessions.

### Step-by-Step Instructions

#### Viewing Prep Tasks
1. **Navigate:** Tap "Prep" tab (pot icon)
2. **Expected:** Timeline of prep tasks

#### Understanding Task Cards
Each task shows:
- Task title and description
- Duration (minutes)
- Required equipment
- Dependencies (what must complete first)
- Status indicator

#### Starting a Prep Session
1. **Action:** Tap "Start Prep Session"
2. **Verify:** Timer starts
3. **Expected:** First task highlighted

#### Completing Tasks
1. **Action:** Tap task checkbox when done
2. **Verify:**
   - Task marked complete (green check)
   - Next task unlocked (if dependent)
   - Progress bar updates

#### Parallel Tasks
1. **Expected:** Some tasks grouped together
2. **Meaning:** Can be done simultaneously
3. **Example:** "Start rice cooker" and "Prep vegetables"

#### Equipment Status
1. **Scroll to:** Equipment panel
2. **Expected:** Status for each item:
   - Stovetop: Available/In Use/Dirty
   - Oven: Available/In Use
   - Rice Cooker: Available/In Use
3. **Action:** Tap to update status

#### Ending Prep Session
1. **Action:** Tap "End Session" when all tasks complete
2. **Verify:**
   - Session summary displayed
   - Total time shown
   - Tasks marked complete

---

## Hydration Tracking

### Overview
Monitor water intake and caffeine consumption.

### Step-by-Step Instructions

#### Water Tracking Tab
1. **Navigate:** Tap "Hydration" tab (water drop icon)
2. **Default view:** Water tracker

##### Logging Water
1. **Quick buttons:** Tap preset amounts
   - 8 oz (1 glass)
   - 16 oz (1 bottle)
   - 32 oz (large bottle)
2. **Custom:** Tap "Custom" and enter amount
3. **Verify:**
   - Progress ring updates
   - Entry added to log

##### Viewing Progress
1. **Expected:**
   - Goal ring (e.g., 0/64 oz)
   - Percentage complete
   - List of today's entries

#### Caffeine Tab
1. **Action:** Tap "Caffeine" tab
2. **Expected:** Caffeine tracker interface

##### Logging Caffeine
1. **Select beverage:**
   - Coffee (95mg/8oz)
   - Tea (47mg/8oz)
   - Soda (30mg/12oz)
   - Energy Drink (150mg/8oz)
2. **Enter amount**
3. **Action:** Tap "Log"
4. **Verify:** Caffeine total updates

##### Caffeine Limits
1. **Indicators:**
   - Green: Safe (<200mg)
   - Yellow: Moderate (200-400mg)
   - Red: Limit reached (>400mg)

#### Trends Tab
1. **Action:** Tap "Trends" tab
2. **Expected:**
   - Weekly hydration chart
   - Daily averages
   - Caffeine patterns

---

## Shopping List Flow

### Overview
Plan shopping trips with optimized store routing.

### Step-by-Step Instructions

#### Viewing Shopping Lists
1. **Navigate:** Tap "Shopping" tab (cart icon)
2. **Expected:** Current week's shopping list

#### List Views

##### Section View
1. **Default view**
2. **Groups items by store section:**
   - Meat & Seafood
   - Dairy
   - Produce
   - Grains & Pasta
   - Canned Goods
   - Oils & Condiments

##### Store View
1. **Action:** Tap "Store" toggle
2. **Groups items by assigned store:**
   - Costco items
   - Safeway items
   - Whole Foods items
3. **Shows:** Store subtotals

#### Adding Items
1. **Action:** Tap "+" button
2. **Enter:**
   - Item name
   - Quantity
   - Category
   - Preferred store (optional)
3. **Action:** Tap "Add"

#### Checking Off Items
1. **While shopping:**
2. **Action:** Tap checkbox next to item
3. **Verify:** Item crossed off
4. **Optional:** Enter actual price paid

#### Viewing Deals
1. **Look for:** Deal badges on items
2. **Indicators:**
   - Green: High confidence deal
   - Yellow: Medium confidence
   - Gray: No deal found
3. **Action:** Tap deal badge for details

#### Store Shopping Mode
1. **Action:** Tap "Start Shopping" at store
2. **Expected:** Optimized route through store
3. **Shows:** Current section and items
4. **Navigate:** Section by section

#### Completing Shopping
1. **Action:** Check off all items
2. **Action:** Tap "Complete Trip"
3. **Verify:**
   - Total spent displayed
   - Savings summary
   - Inventory updated

---

## Analytics & Progress

### Overview
Track weight, adherence, and pattern performance.

### Step-by-Step Instructions

#### Viewing Analytics
1. **Navigate:** Tap "Analytics" tab (chart icon)
2. **Expected:** Multi-section analytics view

#### Weight Tracking
1. **Section:** Weight chart at top
2. **Features:**
   - Line graph of weight over time
   - Trend indicator (up/down)
   - Goal line (if set)
3. **Action:** Tap "Log Weight"
4. **Enter:** Today's weight
5. **Verify:** Chart updates

#### Daily Statistics
1. **Expected cards:**
   - Average daily calories
   - Average daily protein
   - Overall adherence score

#### Adherence Calendar
1. **Visual:** Monthly calendar view
2. **Colors:**
   - Green: High adherence (>80%)
   - Yellow: Moderate (50-80%)
   - Red: Low (<50%)
   - Gray: No data
3. **Action:** Tap any day for details

#### Pattern Performance
1. **Section:** Pattern stats table
2. **Shows for each pattern:**
   - Times used
   - Average satisfaction
   - Average energy
   - Adherence rate
   - Last used date
3. **Action:** Tap pattern for detailed breakdown

#### Timeframe Selection
1. **Options:** Week | Month | All Time
2. **Action:** Tap to switch views
3. **Verify:** All metrics recalculate

---

## Social Event Planning

### Overview
Plan nutrition strategy around social events.

### Step-by-Step Instructions

#### Creating an Event
1. **Navigate:** Dashboard > Menu > Social Events
2. **Action:** Tap "Add Event"
3. **Fill in:**
   - Event name (e.g., "Birthday Dinner")
   - Date and time
   - Meal type (breakfast/brunch/lunch/dinner/drinks)
   - Venue/restaurant (optional)
   - Estimated calorie level:
     - Light (~300-500 cal)
     - Medium (~500-800 cal)
     - Heavy (~800-1200 cal)
     - Unknown
4. **Action:** Tap "Create Event"

#### Calorie Banking Strategy
1. **After creating event:**
2. **Expected:** Banking strategy card showing:
   - Event calorie budget
   - Days until event
   - Daily reduction amount
   - Adjusted daily targets
3. **Example:**
   - Event: 1000 calories
   - 3 days to bank
   - Reduce 333 cal/day
   - New target: 1467 cal/day

#### Pre-Event Day Planning
1. **Navigate:** Event > Pre-Event tab
2. **Shows:**
   - Recommended lighter meals
   - Suggested meal timing
   - Protein priorities
3. **Action:** Apply suggestions to meal plan

#### Recovery Planning
1. **After event:**
2. **Navigate:** Event > Recovery tab
3. **Shows:**
   - Post-event meal recommendations
   - Hydration targets
   - Return-to-normal timeline
4. **Action:** Follow recovery meals

---

## Settings & Preferences

### Overview
Configure app behavior and account settings.

### Step-by-Step Instructions

#### Accessing Settings
1. **Navigate:** Dashboard > Profile icon (top right)
2. **Alternative:** Tab bar > Settings gear

#### Profile Settings
1. **Section:** Personal Info
2. **Edit:**
   - Name
   - Email
   - Height/Weight
   - Target weight
3. **Action:** Tap "Save Changes"

#### Notification Settings
1. **Section:** Notifications
2. **Toggles:**
   - Meal reminders (ON/OFF)
   - Hydration reminders
   - Shopping reminders
   - Weekly summary
3. **Configure times for each**

#### Target Adjustments
1. **Section:** Nutrition Targets
2. **Adjust:**
   - Daily calorie target
   - Daily protein target
   - Weekly weight goal
3. **Verify:** Dashboard updates

#### Theme Settings
1. **Section:** Appearance
2. **Options:**
   - Light mode
   - Dark mode
   - System default
3. **Verify:** App theme changes

#### Data Management
1. **Section:** Data
2. **Options:**
   - Export data (JSON/CSV)
   - Clear history
   - Reset to defaults
3. **Warning:** Confirm before destructive actions

#### Logout
1. **Action:** Tap "Logout"
2. **Confirm:** "Yes, Logout"
3. **Verify:** Returns to Welcome screen

---

## Test Scenarios Checklist

### Critical Path Testing

#### Onboarding
- [ ] Complete full onboarding flow (all 6 steps)
- [ ] Skip onboarding and verify defaults applied
- [ ] Edit profile after onboarding

#### Daily Tracking
- [ ] View dashboard with no meals logged
- [ ] Log breakfast with photo
- [ ] Log lunch with multiple components
- [ ] Log dinner with portion adjustments
- [ ] View updated progress after all meals

#### Pattern Management
- [ ] View all 7 patterns
- [ ] Switch pattern mid-day
- [ ] Verify meal recalculation after switch
- [ ] Cancel pattern switch

#### Inventory
- [ ] Add new inventory item manually
- [ ] Scan barcode (if camera available)
- [ ] Update existing item quantity
- [ ] Delete expired item
- [ ] View expiry warnings

#### Meal Prep
- [ ] Start prep session
- [ ] Complete sequential tasks
- [ ] Complete parallel tasks
- [ ] Update equipment status
- [ ] End session and view summary

#### Hydration
- [ ] Log water using quick buttons
- [ ] Log custom water amount
- [ ] Log caffeine beverage
- [ ] View weekly trends
- [ ] Check caffeine limit warnings

#### Shopping
- [ ] View shopping list by section
- [ ] View shopping list by store
- [ ] Add item to list
- [ ] Check off items while shopping
- [ ] View deal information
- [ ] Complete shopping trip

#### Analytics
- [ ] Log weight entry
- [ ] View weight trend chart
- [ ] Check adherence calendar
- [ ] Review pattern performance
- [ ] Switch timeframe views

### Edge Cases

- [ ] Log meal with 0 components
- [ ] Switch pattern with no remaining meals
- [ ] Add duplicate inventory item
- [ ] Log hydration at midnight (date change)
- [ ] View analytics with no data
- [ ] Complete shopping with all items unavailable

### Performance Testing

- [ ] App loads within 3 seconds
- [ ] Smooth scrolling in long lists
- [ ] Photo capture responds quickly
- [ ] Pattern switch completes within 1 second
- [ ] No lag when checking off shopping items

### Cross-Browser Testing

- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)

---

## Reporting Issues

### How to Report a Bug

1. **Note the following:**
   - What you were trying to do
   - What happened instead
   - Steps to reproduce
   - Browser/device information
   - Screenshots if possible

2. **Submit via:**
   - GitHub Issues: https://github.com/bjpl/meal_assistant/issues
   - Include label: `bug`

### Feature Requests

1. **Describe:**
   - The feature you'd like
   - Why it would be helpful
   - Any design suggestions

2. **Submit via:**
   - GitHub Issues with label: `enhancement`

---

## Version Information

| Component | Version |
|-----------|---------|
| App Version | 1.0.0 |
| Last Updated | November 29, 2025 |
| Expo SDK | 50 |
| React Native | 0.73 |

---

*This guide is maintained by the Meal Assistant development team. For questions, contact the repository maintainers.*
