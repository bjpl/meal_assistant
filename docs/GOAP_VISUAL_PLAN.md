# GOAP Visual Implementation Plan

## Action Dependency Graph

```
START (Current State: 33% Complete)
│
├─► [1] Activate Existing Routes (2h) ◄── QUICK WIN
│   Preconditions: ✅ Route files exist, ✅ Services exist
│   Effects: 4 → 9 routes active
│   Risk: 🟢 Low
│   │
│   ├─► [2] Create Missing Routes (6h) ◄── Can parallelize 4 routes
│   │   Preconditions: ✅ Action 1 complete, ✅ ML API ready
│   │   Effects: 9 → 12 routes active (100%)
│   │   Risk: 🟡 Medium
│   │   │
│   │   └─► [3] Integrate ML Service (4h)
│   │       Preconditions: ✅ Action 2 complete, ✅ FastAPI running
│   │       Effects: ML ↔ Express connected
│   │       Risk: 🟡 Medium
│   │       │
│   │       ├─► [4] Connect Mobile to API (8h) ◄── Can parallelize 6 screens
│   │       │   Preconditions: ✅ Actions 1-3 complete
│   │       │   Effects: Mobile 85% → 100% functional
│   │       │   Risk: 🟡 Medium
│   │       │   │
│   │       │   └─► [5] Refactor Tests (16h) ◄── Can parallelize 4 test suites
│   │       │       Preconditions: ✅ Actions 1-4 complete
│   │       │       Effects: Coverage 18% → 60%+
│   │       │       Risk: 🔴 High
│   │       │       │
│   │       │       └─► [7] E2E Testing (8h)
│   │       │           Preconditions: ✅ Action 5 complete
│   │       │           Effects: Production-ready
│   │       │           Risk: 🟡 Medium
│   │       │           │
│   │       │           └─► [8] Documentation (4h) ◄── Can parallelize 4 docs
│   │       │               Preconditions: ✅ Action 7 complete
│   │       │               Effects: Demo-ready
│   │       │               Risk: 🟢 Low
│   │       │               │
│   │       │               └─► 🎯 GOAL STATE (100% Complete)
│   │       │
│   │       └─► [6] Deploy ML Service (3h)
│   │           Preconditions: ✅ Action 3 complete
│   │           Effects: ML service live on Railway
│   │           Risk: 🟢 Low
│   │           (Runs in parallel with Action 4)
│
└─► Total Critical Path: 51h sequential, 35-40h with parallelization
```

---

## Parallel Work Opportunities

### Week 1: Backend Routes (Can Save 4.5h)

```
Sequential (6h):                    Parallel (1.5h):
ads.routes.ts      → 1.5h          ┌─ ads.routes.ts      (Agent 1) ─┐
templates.routes.ts → 1.5h         ├─ templates.routes.ts (Agent 2) ─┤
prices.routes.ts   → 1.5h          ├─ prices.routes.ts   (Agent 3) ─┤ → All done in 1.5h
deals.routes.ts    → 1.5h          └─ deals.routes.ts    (Agent 4) ─┘
TOTAL: 6h                          TOTAL: 1.5h (4 agents)
```

---

### Week 2: Mobile Integration (Can Save 6.5h)

```
Sequential (8h):                    Parallel (1.5h):
Dashboard    → 1.5h                ┌─ Dashboard    (Agent 1) ─┐
Inventory    → 1.5h                ├─ Inventory    (Agent 2) ─┤
Shopping     → 1.5h                ├─ Shopping     (Agent 3) ─┤
Prep         → 1.5h                ├─ Prep         (Agent 4) ─┤ → All done in 1.5h
Analytics    → 1h                  ├─ Analytics    (Agent 5) ─┤
Ads          → 1h                  └─ Ads          (Agent 6) ─┘
TOTAL: 8h                          TOTAL: 1.5h (6 agents)
```

---

### Week 3-4: Test Refactoring (Can Save 12h)

```
Sequential (16h):                   Parallel (4h):
Service Tests    → 4h              ┌─ Service Tests    (Agent 1) ─┐
API Tests        → 4h              ├─ API Tests        (Agent 2) ─┤
E2E Tests        → 4h              ├─ E2E Tests        (Agent 3) ─┤ → All done in 4h
Performance Tests → 4h             └─ Performance Tests (Agent 4) ─┘
TOTAL: 16h                         TOTAL: 4h (4 agents)
```

---

### Week 5: Documentation (Can Save 2h)

```
Sequential (4h):                    Parallel (2h):
API Docs     → 1h                  ┌─ API Docs     (Agent 1) ─┐
User Guide   → 1h                  ├─ User Guide   (Agent 1) ─┤ → All done in 2h
Architecture → 1h                  ├─ Architecture (Agent 2) ─┤
Demo Video   → 1h                  └─ Demo Video   (Agent 2) ─┘
TOTAL: 4h                          TOTAL: 2h (2 agents)
```

---

## Resource Allocation Timeline

### Solo Developer (51 hours over 6 weeks)

```
Week 1: Backend [12h]
├─ Mon:    [2h] Activate routes
├─ Tue:    [2h] Test activated routes
├─ Wed:    [3h] Create ads + templates routes
├─ Thu:    [3h] Create prices + deals routes
└─ Fri:    [2h] ML integration

Week 2: Frontend [11h]
├─ Mon:    [3h] Connect Dashboard + Inventory
├─ Tue:    [3h] Connect Shopping + Prep
├─ Wed:    [2h] Connect Analytics + Ads
├─ Thu:    [2h] Deploy ML service
└─ Fri:    [1h] Integration testing

Week 3: Tests Part 1 [8h]
├─ Mon:    [2h] Setup test database
├─ Tue:    [3h] Refactor service tests
├─ Wed:    [3h] Refactor API tests

Week 4: Tests Part 2 [8h]
├─ Mon:    [3h] E2E tests
├─ Tue:    [3h] Performance tests
└─ Wed:    [2h] Coverage analysis

Week 5: Polish [8h]
├─ Mon:    [3h] E2E user testing
├─ Tue:    [3h] Bug fixes
└─ Wed:    [2h] Performance optimization

Week 6: Launch [4h]
├─ Mon:    [2h] Documentation
└─ Tue:    [2h] Demo video + README
```

---

### Team of 4 (23 hours over 3 weeks)

```
Week 1: Backend Setup [11h]
Backend Dev (Lead):
├─ Mon:    [2h] Activate routes
├─ Mon:    [2h] Create ads.routes.ts
├─ Tue:    [2h] ML integration
├─ Wed:    [2h] Deploy ML service
└─ Thu:    [3h] Integration testing

Backend Dev 2 (Support):
├─ Mon:    [2h] Create templates.routes.ts
├─ Tue:    [2h] Create prices.routes.ts
└─ Wed:    [2h] Create deals.routes.ts

Week 2: Frontend [8h]
Mobile Dev 1:
├─ Mon:    [2h] Dashboard + Inventory
└─ Tue:    [2h] Shopping + Prep

Mobile Dev 2:
├─ Mon:    [2h] Analytics screens
└─ Tue:    [2h] Ads screens

Week 3: Testing [16h]
Test Engineer 1:
├─ Mon:    [2h] Setup test DB
├─ Tue:    [3h] Service tests
├─ Wed:    [3h] API tests

Test Engineer 2:
├─ Thu:    [3h] E2E tests
├─ Fri:    [3h] Performance tests

Week 3: Documentation [4h]
Tech Writer:
└─ Fri:    [4h] All documentation
```

---

## Risk Mitigation Flowchart

```
[Start Action] → Check Preconditions
                 │
                 ├─ ✅ All Met → Proceed
                 │               │
                 │               ├─ Success → Update World State
                 │               │            └─► Next Action
                 │               │
                 │               └─ Failure → Analyze Error
                 │                            │
                 │                            ├─ Quick Fix (< 1h)
                 │                            │   └─► Retry Action
                 │                            │
                 │                            └─ Complex Issue (> 1h)
                 │                                └─► Activate Fallback Plan
                 │
                 └─ ❌ Not Met → Wait for Dependencies
                                 └─► Work on Parallel Task
```

---

## Current State → Goal State Visualization

```
CURRENT STATE (33%)                      GOAL STATE (100%)
═══════════════════════════════════════════════════════════

API Routes:                             API Routes:
├─ ✅ auth (177 lines)                  ├─ ✅ auth (177 lines)
├─ ✅ patterns (249 lines)              ├─ ✅ patterns (249 lines)
├─ ✅ meals (279 lines)                 ├─ ✅ meals (279 lines)
├─ ✅ vector (458 lines)                ├─ ✅ vector (458 lines)
├─ ❌ inventory (commented)             ├─ ✅ inventory (265 lines)
├─ ❌ prep (commented)                  ├─ ✅ prep (419 lines)
├─ ❌ shopping (commented)              ├─ ✅ shopping (303 lines)
├─ ❌ analytics (commented)             ├─ ✅ analytics (305 lines)
├─ ❌ hydration (commented)             ├─ ✅ hydration (291 lines)
├─ ❌ ads (missing)                     ├─ ✅ ads (new, ~200 lines)
├─ ❌ templates (missing)               ├─ ✅ templates (new, ~200 lines)
├─ ❌ prices (missing)                  ├─ ✅ prices (new, ~200 lines)
└─ ❌ deals (missing)                   └─ ✅ deals (new, ~200 lines)

Mobile Integration:                     Mobile Integration:
├─ ✅ Screens (25+)                     ├─ ✅ Screens (25+)
├─ ✅ Components (100+)                 ├─ ✅ Components (100+)
├─ ⚠️  API Client (partial)             ├─ ✅ API Client (complete)
└─ ❌ Real Data (mocked)                └─ ✅ Real Data (live API)

Testing:                                Testing:
├─ ⚠️  68 test files (18% coverage)    ├─ ✅ 68+ test files (60%+ coverage)
├─ ❌ Mock-based tests                  ├─ ✅ Real implementation tests
└─ ⚠️  Some tests passing               └─ ✅ All tests passing

ML Service:                             ML Service:
├─ ✅ FastAPI server (1533 lines)      ├─ ✅ FastAPI server (1533 lines)
├─ ✅ 20+ models implemented            ├─ ✅ 20+ models implemented
├─ ❌ Not integrated with main API     ├─ ✅ Integrated with Express
└─ ❌ Not deployed                      └─ ✅ Deployed to Railway

Deployment:                             Deployment:
├─ ✅ Docker configured                 ├─ ✅ Docker configured
├─ ✅ Railway setup                     ├─ ✅ Railway setup
├─ ⚠️  Main API deployed                ├─ ✅ Main API deployed
├─ ❌ ML service not deployed           ├─ ✅ ML service deployed
└─ ❌ No live demo                      └─ ✅ Live demo available

Documentation:                          Documentation:
├─ ⚠️  README (basic)                   ├─ ✅ README (comprehensive)
├─ ❌ API docs missing                  ├─ ✅ API docs complete
├─ ❌ User guide missing                ├─ ✅ User guide available
└─ ❌ Demo video missing                └─ ✅ Demo video published
```

---

## Progress Tracking Dashboard

### Phase 1: Backend Foundation (Week 1)
```
[████████████████████░░░░░░░░] 75% → 100%
├─ Activate routes        [████████████████████] Done
├─ Create missing routes  [████████████░░░░░░░░] In Progress
└─ ML integration         [░░░░░░░░░░░░░░░░░░░░] Pending
```

### Phase 2: Frontend Integration (Week 2)
```
[░░░░░░░░░░░░░░░░░░░░] 0% → 100%
├─ Connect screens        [░░░░░░░░░░░░░░░░░░░░] Pending
└─ Deploy ML service      [░░░░░░░░░░░░░░░░░░░░] Pending
```

### Phase 3: Testing (Weeks 3-4)
```
[███░░░░░░░░░░░░░░░░░] 18% → 60%
├─ Unit tests             [███░░░░░░░░░░░░░░░░░] Needs refactor
├─ Integration tests      [██░░░░░░░░░░░░░░░░░░] Needs refactor
└─ E2E tests              [█░░░░░░░░░░░░░░░░░░░] Needs refactor
```

### Phase 4: Launch (Week 5-6)
```
[░░░░░░░░░░░░░░░░░░░░] 0% → 100%
├─ E2E testing            [░░░░░░░░░░░░░░░░░░░░] Pending
├─ Documentation          [░░░░░░░░░░░░░░░░░░░░] Pending
└─ Demo                   [░░░░░░░░░░░░░░░░░░░░] Pending
```

---

## Decision Tree: Which Action Next?

```
Current Position: Start
│
├─ Have 4 hours today?
│  │
│  ├─ YES → Do Action 1 (Activate Routes) + partial Action 2
│  │        Quick wins, immediate progress
│  │
│  └─ NO → Only 2 hours?
│     │
│     ├─ YES → Do Action 1 only (Activate Routes)
│     │        Still delivers 5 new routes
│     │
│     └─ NO → Plan for later
│
├─ Routes active (Action 1 done)?
│  │
│  ├─ YES → Do Action 2 (Create missing routes)
│  │        Unlock ML features
│  │
│  └─ NO → Must complete Action 1 first
│
├─ All routes created (Action 2 done)?
│  │
│  ├─ YES → Parallel choice:
│  │        ├─ Backend focused → Action 3 (ML Integration)
│  │        └─ Frontend focused → Action 4 (Mobile Integration)
│  │
│  └─ NO → Must complete Action 2 first
│
├─ API complete (Actions 1-3 done)?
│  │
│  ├─ YES → Do Action 4 (Mobile Integration)
│  │        Make app fully functional
│  │
│  └─ NO → Complete backend first
│
├─ Mobile connected (Action 4 done)?
│  │
│  ├─ YES → Do Action 5 (Test Refactoring)
│  │        Longest action, most critical
│  │
│  └─ NO → Complete mobile first
│
├─ Tests passing (Action 5 done)?
│  │
│  ├─ YES → Do Action 7 (E2E Testing)
│  │        Final quality check
│  │
│  └─ NO → Fix failing tests
│
└─ E2E passed (Action 7 done)?
   │
   ├─ YES → Do Action 8 (Documentation)
   │        Launch-ready!
   │
   └─ NO → Fix integration issues

🎯 = GOAL: Production system with live demo
```

---

## Effort vs Impact Matrix

```
High Impact ↑
           │
           │  [1] Activate     [5] Test
           │      Routes ⚡         Refactor 📊
           │      (2h)              (16h)
           │
           │  [2] Create       [4] Mobile
           │      Routes 🔧        Integration 📱
           │      (6h)              (8h)
           │
           │  [3] ML           [7] E2E
           │      Integration 🤖    Testing ✓
           │      (4h)              (8h)
           │
           │  [6] Deploy       [8] Docs
           │      ML Service 🚀     & Demo 📝
           │      (3h)              (4h)
           │
Low Impact ↓─────────────────────────────────►
           Low Effort         High Effort

Priority Order (by ROI):
1. ⚡ Activate Routes (2h, massive impact)
2. 🔧 Create Routes (6h, unlocks features)
3. 🤖 ML Integration (4h, connects services)
4. 🚀 Deploy ML (3h, production-ready ML)
5. 📱 Mobile Integration (8h, user-facing)
6. 📊 Test Refactor (16h, quality assurance)
7. ✓ E2E Testing (8h, final validation)
8. 📝 Documentation (4h, launch-ready)
```

---

## The "First 8 Hours" Playbook

### Hour 1-2: Activate Routes ⚡
```bash
# 1. Open server.ts
cd src/api
code server.ts

# 2. Uncomment lines 21-25 (imports)
# Before:
// const inventoryRoutes = require('./routes/inventory');
// const prepRoutes = require('./routes/prep');
// ...

# After:
const inventoryRoutes = require('./routes/inventory.routes').default;
const prepRoutes = require('./routes/prep.routes').default;
const shoppingRoutes = require('./routes/shopping.routes').default;
const analyticsRoutes = require('./routes/analytics.routes').default;
const hydrationRoutes = require('./routes/hydration.routes').default;

# 3. Uncomment lines 72-76 (mounts)
app.use('/api/inventory', inventoryRoutes);
app.use('/api/prep', prepRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/hydration', hydrationRoutes);

# 4. Build and test
npm run build
npm start

# 5. Test each endpoint
curl http://localhost:3000/api/inventory
# Expected: 401 Unauthorized (good - auth required)
```

**Deliverable:** 5 new routes active (4 → 9 routes)

---

### Hour 3-4: Test Activated Routes
```bash
# 1. Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 2. Save token
export TOKEN="<token-from-response>"

# 3. Test each route with auth
curl http://localhost:3000/api/inventory \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/shopping \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/prep \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/hydration \
  -H "Authorization: Bearer $TOKEN"

# 4. Document any errors
# 5. Fix import/export issues
```

**Deliverable:** All 9 routes responding correctly

---

### Hour 5-6: Start Ad Routes
```bash
# 1. Create new file
touch src/api/routes/ads.routes.ts

# 2. Copy template from existing route
# 3. Add ML service proxy endpoints
# 4. Test locally

# Expected completion: 50% of ads.routes.ts
```

**Deliverable:** Foundation for ML integration

---

### Hour 7-8: Complete Ad Routes
```bash
# 1. Finish ads.routes.ts
# 2. Add to server.ts
# 3. Test endpoints
# 4. Document API

# 4 routes created by end:
# - /api/ads/parse
# - /api/ads/match
# - /api/ads/learn
# - /api/ads/accuracy
```

**Deliverable:** 10/12 routes active (83% API complete)

---

## Success Visualization

```
DAY 1 END (8 hours):
├─ 9/12 routes active (75%)
├─ 1/4 missing routes started
├─ Immediate user value: Inventory, Shopping, Prep, Analytics, Hydration
└─ Momentum: Team sees real progress

WEEK 1 END (12 hours):
├─ 12/12 routes active (100%)
├─ ML service integrated
└─ Backend complete: Ready for frontend

WEEK 2 END (23 hours):
├─ Mobile app fully connected
├─ ML service deployed
└─ End-to-end functionality working

WEEK 4 END (39 hours):
├─ Tests refactored (60%+ coverage)
├─ All tests passing
└─ High confidence in codebase

WEEK 6 END (51 hours):
├─ E2E testing complete
├─ Documentation published
├─ Demo video live
└─ 🎯 PROJECT COMPLETE - Production-ready!
```

---

This visual plan complements the detailed GOAP roadmap with:
- Dependency graphs for clear sequencing
- Parallel work breakdowns for time savings
- Resource allocation for team planning
- Progress tracking for motivation
- Decision trees for next-step clarity
- Effort/impact matrix for prioritization
- First 8 hours playbook for immediate action
