import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { UserPreferences, PatternId } from '../../types';
import { authApi } from '../../services/apiService';

interface UserState {
  preferences: UserPreferences;
  profile: {
    name: string;
    startWeight: number;
    targetWeight: number;
    height: number; // inches
    age: number;
    email?: string;
  };
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  lastActiveDate: string | null;
  loading: boolean;
  error: string | null;
}

const defaultPreferences: UserPreferences = {
  targetCalories: 1800,
  targetProtein: 135,
  primaryPattern: 'A',
  notificationsEnabled: true,
  mealReminders: {
    morning: '07:30',
    noon: '12:00',
    evening: '18:30',
  },
  theme: 'system',
  units: 'imperial',
};

const initialState: UserState = {
  preferences: defaultPreferences,
  profile: {
    name: '',
    startWeight: 0,
    targetWeight: 0,
    height: 0,
    age: 0,
  },
  isAuthenticated: false,
  onboardingComplete: false,
  lastActiveDate: null,
  loading: false,
  error: null,
};

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const registerUser = createAsyncThunk(
  'user/register',
  async ({ email, password, name }: { email: string; password: string; name?: string }, { rejectWithValue }) => {
    const response = await authApi.register(email, password, { name });
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const loginUser = createAsyncThunk(
  'user/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    const response = await authApi.login(email, password);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const logoutUser = createAsyncThunk(
  'user/logout',
  async (allDevices: boolean = false, { rejectWithValue }) => {
    const response = await authApi.logout(allDevices);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return true;
  }
);

export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    const response = await authApi.getProfile();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const updatePassword = createAsyncThunk(
  'user/updatePassword',
  async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }, { rejectWithValue }) => {
    const response = await authApi.updatePassword(currentPassword, newPassword);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return true;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },
    setTargetCalories: (state, action: PayloadAction<number>) => {
      state.preferences.targetCalories = action.payload;
    },
    setTargetProtein: (state, action: PayloadAction<number>) => {
      state.preferences.targetProtein = action.payload;
    },
    setPrimaryPattern: (state, action: PayloadAction<PatternId>) => {
      state.preferences.primaryPattern = action.payload;
    },
    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.preferences.notificationsEnabled = action.payload;
    },
    setMealReminder: (
      state,
      action: PayloadAction<{
        meal: 'morning' | 'noon' | 'evening';
        time: string;
      }>
    ) => {
      state.preferences.mealReminders[action.payload.meal] = action.payload.time;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.preferences.theme = action.payload;
    },
    setUnits: (state, action: PayloadAction<'imperial' | 'metric'>) => {
      state.preferences.units = action.payload;
    },
    updateProfile: (
      state,
      action: PayloadAction<Partial<UserState['profile']>>
    ) => {
      state.profile = { ...state.profile, ...action.payload };
    },
    setTargetWeight: (state, action: PayloadAction<number>) => {
      state.profile.targetWeight = action.payload;
    },
    completeOnboarding: (state) => {
      state.onboardingComplete = true;
    },
    setLastActiveDate: (state, action: PayloadAction<string>) => {
      state.lastActiveDate = action.payload;
    },
    resetPreferences: (state) => {
      state.preferences = defaultPreferences;
    },
  },
  extraReducers: (builder) => {
    builder
      // registerUser
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        if (action.payload) {
          const { user } = action.payload as any;
          state.profile = {
            ...state.profile,
            name: user.name || '',
            email: user.email,
          };
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // loginUser
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        if (action.payload) {
          const { user } = action.payload as any;
          state.profile = {
            ...state.profile,
            name: user.name || '',
            email: user.email,
          };
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // logoutUser
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.profile = initialState.profile;
      })
      // fetchUserProfile
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const { user } = action.payload as any;
          state.profile = {
            ...state.profile,
            name: user.name || '',
            email: user.email,
          };
          state.isAuthenticated = true;
        }
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updatePassword
      .addCase(updatePassword.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  setLoading,
  setError,
  setPreferences,
  setTargetCalories,
  setTargetProtein,
  setPrimaryPattern,
  setNotificationsEnabled,
  setMealReminder,
  setTheme,
  setUnits,
  updateProfile,
  setTargetWeight,
  completeOnboarding,
  setLastActiveDate,
  resetPreferences,
} = userSlice.actions;

export default userSlice.reducer;
