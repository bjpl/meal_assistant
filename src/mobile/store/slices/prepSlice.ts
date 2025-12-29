import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { PrepTask, PrepSession, Equipment } from '../../types';
import { prepApi } from '../../services/apiService';

// =============================================================================
// ASYNC THUNKS - API Integration
// =============================================================================

export const fetchCurrentSession = createAsyncThunk(
  'prep/fetchCurrentSession',
  async (_, { rejectWithValue }) => {
    const response = await prepApi.getCurrentSession();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const startSessionAsync = createAsyncThunk(
  'prep/startSession',
  async (session: Omit<PrepSession, 'id' | 'status' | 'startTime'>, { rejectWithValue }) => {
    const response = await prepApi.startSession(session);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const endSessionAsync = createAsyncThunk(
  'prep/endSession',
  async (sessionId: string, { rejectWithValue }) => {
    const response = await prepApi.endSession(sessionId);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return sessionId;
  }
);

export const updateTaskStatusAsync = createAsyncThunk(
  'prep/updateTaskStatus',
  async ({ sessionId, taskId, status }: { sessionId: string; taskId: string; status: PrepTask['status'] }, { rejectWithValue }) => {
    const response = await prepApi.updateTaskStatus(sessionId, taskId, status);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return { taskId, status };
  }
);

export const fetchTemplates = createAsyncThunk(
  'prep/fetchTemplates',
  async (_, { rejectWithValue }) => {
    const response = await prepApi.getTemplates();
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const createTemplateAsync = createAsyncThunk(
  'prep/createTemplate',
  async (template: Omit<PrepSession, 'id'>, { rejectWithValue }) => {
    const response = await prepApi.createTemplate(template);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

export const fetchPastSessions = createAsyncThunk(
  'prep/fetchPastSessions',
  async (limit: number = 10, { rejectWithValue }) => {
    const response = await prepApi.getPastSessions(limit);
    if (response.error) {
      return rejectWithValue(response.message || response.error);
    }
    return response.data;
  }
);

interface PrepState {
  currentSession: PrepSession | null;
  pastSessions: PrepSession[];
  equipment: Equipment[];
  templates: PrepSession[]; // Reusable prep session templates
  loading: boolean;
  error: string | null;
}

const defaultEquipment: Equipment[] = [
  { id: '1', name: 'Stovetop', status: 'available', icon: '\u{1F373}' },
  { id: '2', name: 'Oven', status: 'available', icon: '\u{1F3ED}' },
  { id: '3', name: 'Rice Cooker', status: 'available', icon: '\u{1F35A}' },
  { id: '4', name: 'Cutting Board', status: 'available', icon: '\u{1F52A}' },
  { id: '5', name: 'Blender', status: 'available', icon: '\u{1F964}' },
  { id: '6', name: 'Instant Pot', status: 'available', icon: '\u{1F372}' },
  { id: '7', name: 'Air Fryer', status: 'available', icon: '\u{1F32D}' },
  { id: '8', name: 'Grill Pan', status: 'available', icon: '\u{1F356}' },
];

const initialState: PrepState = {
  currentSession: null,
  pastSessions: [],
  equipment: defaultEquipment,
  templates: [],
  loading: false,
  error: null,
};

const prepSlice = createSlice({
  name: 'prep',
  initialState,
  reducers: {
    startSession: (state, action: PayloadAction<PrepSession>) => {
      state.currentSession = {
        ...action.payload,
        status: 'in-progress',
        startTime: new Date().toISOString(),
      };
    },
    endSession: (state) => {
      if (state.currentSession) {
        state.currentSession.status = 'completed';
        state.currentSession.endTime = new Date().toISOString();
        state.pastSessions.push(state.currentSession);
        state.currentSession = null;
        // Reset equipment status
        state.equipment.forEach((eq) => {
          if (eq.status === 'in-use') {
            eq.status = 'dirty';
          }
        });
      }
    },
    updateTaskStatus: (
      state,
      action: PayloadAction<{ taskId: string; status: PrepTask['status'] }>
    ) => {
      if (state.currentSession) {
        const task = state.currentSession.tasks.find(
          (t) => t.id === action.payload.taskId
        );
        if (task) {
          task.status = action.payload.status;
        }
      }
    },
    setEquipmentStatus: (
      state,
      action: PayloadAction<{
        equipmentId: string;
        status: Equipment['status'];
        currentTask?: string;
      }>
    ) => {
      const equipment = state.equipment.find(
        (e) => e.id === action.payload.equipmentId
      );
      if (equipment) {
        equipment.status = action.payload.status;
        equipment.currentTask = action.payload.currentTask;
      }
    },
    resetEquipment: (state) => {
      state.equipment.forEach((eq) => {
        eq.status = 'available';
        eq.currentTask = undefined;
      });
    },
    addTemplate: (state, action: PayloadAction<PrepSession>) => {
      state.templates.push(action.payload);
    },
    deleteTemplate: (state, action: PayloadAction<string>) => {
      state.templates = state.templates.filter((t) => t.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCurrentSession
      .addCase(fetchCurrentSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentSession.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentSession = action.payload as PrepSession;
        }
      })
      .addCase(fetchCurrentSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // startSessionAsync
      .addCase(startSessionAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(startSessionAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.currentSession = {
            ...(action.payload as PrepSession),
            status: 'in-progress',
            startTime: new Date().toISOString(),
          };
        }
      })
      .addCase(startSessionAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // endSessionAsync
      .addCase(endSessionAsync.fulfilled, (state) => {
        if (state.currentSession) {
          state.currentSession.status = 'completed';
          state.currentSession.endTime = new Date().toISOString();
          state.pastSessions.push(state.currentSession);
          state.currentSession = null;
          state.equipment.forEach(eq => {
            if (eq.status === 'in-use') {
              eq.status = 'dirty';
            }
          });
        }
      })
      // updateTaskStatusAsync
      .addCase(updateTaskStatusAsync.fulfilled, (state, action) => {
        if (state.currentSession) {
          const task = state.currentSession.tasks.find(t => t.id === action.payload.taskId);
          if (task) {
            task.status = action.payload.status;
          }
        }
      })
      // fetchTemplates
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        if (action.payload) {
          state.templates = action.payload as PrepSession[];
        }
      })
      // createTemplateAsync
      .addCase(createTemplateAsync.fulfilled, (state, action) => {
        if (action.payload) {
          state.templates.push(action.payload as PrepSession);
        }
      })
      // fetchPastSessions
      .addCase(fetchPastSessions.fulfilled, (state, action) => {
        if (action.payload) {
          state.pastSessions = action.payload as PrepSession[];
        }
      });
  },
});

export const {
  startSession,
  endSession,
  updateTaskStatus,
  setEquipmentStatus,
  resetEquipment,
  addTemplate,
  deleteTemplate,
  setLoading,
  setError,
} = prepSlice.actions;

// Selectors
export const selectCurrentSession = (state: { prep: PrepState }) => state.prep.currentSession;
export const selectPrepLoading = (state: { prep: PrepState }) => state.prep.loading;
export const selectPrepError = (state: { prep: PrepState }) => state.prep.error;
export const selectPastSessions = (state: { prep: PrepState }) => state.prep.pastSessions;
export const selectEquipment = (state: { prep: PrepState }) => state.prep.equipment;
export const selectTemplates = (state: { prep: PrepState }) => state.prep.templates;

// Convenience thunk for completing a task - wrapper around updateTaskStatus
export const completeTask = (payload: { sessionId: string; taskId: string }) =>
  updateTaskStatusAsync({ ...payload, status: 'completed' });

export default prepSlice.reducer;
