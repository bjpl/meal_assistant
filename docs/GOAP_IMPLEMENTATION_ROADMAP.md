# Goal-Oriented Action Planning (GOAP) - Meal Assistant Completion

## Executive Summary

**Current State**: Partially functional system with 4/12 routes active, 18% test coverage, infrastructure ready
**Goal State**: Production-ready application with all features active, 60%+ test coverage, deployed with live demo
**Estimated Duration**: 4-6 weeks (60-80 hours)
**Risk Level**: Medium (most components exist but need integration and testing)

---

## 1. World State Analysis

### Current Facts (What EXISTS)

#### ✅ Infrastructure (100% Complete)
- Docker multi-stage builds configured
- Railway deployment setup
- CI/CD pipeline with GitHub Actions
- PostgreSQL database with migrations
- RuVector vector database integrated

#### ✅ Backend Core (33% Complete)
- **Active Routes** (4/12): `auth`, `patterns`, `meals`, `vector`
- **Route Files Exist** (9/12): All above + `inventory`, `shopping`, `prep`, `analytics`, `hydration`
- **Database Services** (9/9): All services implemented
- Express server with security middleware
- Authentication middleware

#### ✅ Frontend/Mobile (85% Complete)
- React Native mobile app with 25+ screens
- Redux store with persistence
- Navigation system (App + Onboarding)
- 100+ UI components across features:
  - Ads components (9 components)
  - Analytics components (11 components)
  - Inventory, Shopping, Prep screens
- Offline sync service

#### ✅ ML Services (90% Complete)
- FastAPI inference server (1533 lines)
- 20+ ML models implemented:
  - Pattern recommender v2 (17 features)
  - Deal matching with progressive learning
  - Route optimization
  - Store visit predictor
  - Traffic pattern learner
  - Savings validator
- Complete API endpoints for ML features

#### ⚠️ Testing (18% Actual Coverage)
- 68 test files exist
- Tests use mocks instead of real implementations
- Coverage: 18% (target: 60%+)

### Missing Facts (What DOESN'T EXIST)

#### ❌ Backend Routes (Not Active)
- `/api/inventory` - File exists, not mounted in server.ts
- `/api/shopping` - File exists, not mounted in server.ts
- `/api/prep` - File exists, not mounted in server.ts
- `/api/analytics` - File exists, not mounted in server.ts
- `/api/hydration` - File exists, not mounted in server.ts
- `/api/ads` - File doesn't exist (ML API has endpoints)
- `/api/templates` - File doesn't exist
- `/api/prices` - File doesn't exist
- `/api/deals` - File doesn't exist

#### ❌ Integration Gaps
- Mobile app not connected to API endpoints
- ML service not integrated with main API
- Tests not running against real code

#### ❌ Deployment Gaps
- No live demo URL
- Railway deployment not verified
- ML service deployment unclear

---

## 2. GOAP Actions with Preconditions & Effects

### Action 1: Activate Existing Routes
**Preconditions:**
- Route files exist (inventory, shopping, prep, analytics, hydration)
- Database services exist
- Authentication middleware available

**Procedure:**
1. Uncomment route imports in `server.ts`
2. Add route mounting statements
3. Verify route exports
4. Test each endpoint manually

**Effects:**
- `routes_active`: 4 → 9
- `api_completion`: 33% → 75%

**Effort:** 2 hours
**Risk:** Low (files already exist)
**Dependencies:** None
**Parallelizable:** No (must test sequentially)

---

### Action 2: Create Missing Route Files
**Preconditions:**
- ML API endpoints exist for ads, templates, prices, deals
- Database schema supports features
- Authentication available

**Procedure:**
1. Create `ads.routes.ts` - Proxy to ML service
2. Create `templates.routes.ts` - Template management
3. Create `prices.routes.ts` - Price tracking
4. Create `deals.routes.ts` - Deal aggregation
5. Mount routes in server.ts

**Effects:**
- `routes_active`: 9 → 12
- `api_completion`: 75% → 100%
- `ml_integration_status`: 0% → 50%

**Effort:** 6 hours
**Risk:** Medium (requires ML service integration)
**Dependencies:** Action 1 complete
**Parallelizable:** Yes (can create routes concurrently)

---

### Action 3: Integrate ML Service with Main API
**Preconditions:**
- ML FastAPI service running (api.py exists)
- Main Express API running
- Routes for ads/templates/prices created

**Procedure:**
1. Create ML service client in main API
2. Add HTTP client for FastAPI endpoints
3. Implement error handling for ML service
4. Add fallback mechanisms
5. Create health check integration

**Effects:**
- `ml_integration_status`: 50% → 100%
- `api_robustness`: +30%

**Effort:** 4 hours
**Risk:** Medium (cross-service communication)
**Dependencies:** Action 2 complete
**Parallelizable:** No (requires both services running)

---

### Action 4: Connect Mobile App to API
**Preconditions:**
- All API routes active (Actions 1-3 complete)
- Mobile app has service files
- API base URL configurable

**Procedure:**
1. Update API client configuration in mobile
2. Connect each screen to real API endpoints:
   - Dashboard → `/api/patterns`, `/api/analytics`
   - Inventory → `/api/inventory`
   - Shopping → `/api/shopping`
   - Prep → `/api/prep`
   - Analytics → `/api/analytics`
   - Ads → `/api/ads`
3. Remove mock data calls
4. Implement error handling
5. Test each screen with real data

**Effects:**
- `mobile_api_integration`: 0% → 100%
- `app_functionality`: 60% → 95%

**Effort:** 8 hours
**Risk:** Medium (25+ screens to connect)
**Dependencies:** Actions 1-3 complete
**Parallelizable:** Yes (can work on different screens concurrently)

---

### Action 5: Refactor Tests to Use Real Code
**Preconditions:**
- API routes active
- Services implemented
- Test framework configured

**Procedure:**
1. Identify all tests using mocks
2. Create test database setup
3. Rewrite unit tests:
   - Remove mocks for services
   - Use real database connections
   - Add setup/teardown
4. Rewrite integration tests:
   - Use real API endpoints
   - Test full request/response cycle
5. Update test configuration

**Effects:**
- `test_coverage`: 18% → 60%+
- `test_quality`: mock-based → real implementation
- `confidence_in_code`: +50%

**Effort:** 16 hours (largest effort)
**Risk:** High (extensive refactoring)
**Dependencies:** Actions 1-4 complete (need working system)
**Parallelizable:** Yes (different test suites)

---

### Action 6: Deploy ML Service
**Preconditions:**
- ML service tested locally
- Railway account configured
- Docker images ready

**Procedure:**
1. Create Dockerfile for ML service
2. Configure Railway service for ML
3. Set environment variables
4. Deploy and test
5. Connect to main API

**Effects:**
- `ml_service_deployed`: false → true
- `system_completeness`: +10%

**Effort:** 3 hours
**Risk:** Low (Railway supports Python)
**Dependencies:** Action 3 complete
**Parallelizable:** No (sequential deployment)

---

### Action 7: End-to-End Testing & Polish
**Preconditions:**
- All routes active
- Mobile app connected
- Tests passing
- Services deployed

**Procedure:**
1. Perform user journey testing
2. Test offline capabilities
3. Verify sync service
4. Load testing
5. Security audit
6. Performance optimization
7. Bug fixes

**Effects:**
- `user_experience`: +20%
- `production_readiness`: 80% → 100%
- `bug_count`: -50%

**Effort:** 8 hours
**Risk:** Medium (may uncover integration issues)
**Dependencies:** All previous actions complete
**Parallelizable:** No (requires complete system)

---

### Action 8: Documentation & Demo
**Preconditions:**
- System fully functional
- Deployed to Railway
- Tests passing

**Procedure:**
1. Create demo video
2. Write API documentation
3. Update README with live demo link
4. Create user guide
5. Document architecture decisions

**Effects:**
- `documentation_quality`: +30%
- `demo_available`: false → true
- `project_marketability`: +40%

**Effort:** 4 hours
**Risk:** Low
**Dependencies:** Action 7 complete
**Parallelizable:** Yes (different documentation types)

---

## 3. Optimal Action Sequence (A* Search Result)

### Critical Path (Sequential - Must Complete in Order)

```
Week 1: Backend Activation
├─ Day 1-2: Action 1 - Activate Existing Routes (2h)
├─ Day 2-3: Action 2 - Create Missing Routes (6h)
└─ Day 3-4: Action 3 - Integrate ML Service (4h)

Week 2: Frontend Integration
├─ Day 5-7: Action 4 - Connect Mobile to API (8h)
└─ Day 8-9: Action 6 - Deploy ML Service (3h)

Week 3-4: Testing & Quality
└─ Day 10-17: Action 5 - Refactor Tests (16h)

Week 5: Final Polish
├─ Day 18-21: Action 7 - E2E Testing (8h)
└─ Day 22-23: Action 8 - Documentation (4h)
```

**Total Sequential Time:** 51 hours
**With Parallel Work:** 35-40 hours

---

## 4. Parallelizable Work Groups

### Group A: Backend Routes (Can Run Concurrently)
- Create ads.routes.ts
- Create templates.routes.ts
- Create prices.routes.ts
- Create deals.routes.ts

**Agents:** 4 backend developers
**Duration:** 1.5 hours (instead of 6h sequential)

---

### Group B: Mobile Screen Integration (Can Run Concurrently)
- Dashboard screen
- Inventory screen
- Shopping screen
- Prep screen
- Analytics screens
- Ads screens

**Agents:** 6 mobile developers
**Duration:** 1.5 hours (instead of 8h sequential)

---

### Group C: Test Suite Refactoring (Can Run Concurrently)
- Unit tests (services)
- Integration tests (API)
- E2E tests (user flows)
- Performance tests

**Agents:** 4 test engineers
**Duration:** 4 hours (instead of 16h sequential)

---

### Group D: Documentation (Can Run Concurrently)
- API documentation
- User guide
- Architecture docs
- Demo video

**Agents:** 2 technical writers
**Duration:** 2 hours (instead of 4h sequential)

---

## 5. Risk Assessment & Mitigation

### High Risk Actions

#### Action 5: Test Refactoring (Risk: 8/10)
**Risks:**
- Uncovering hidden bugs in services
- Database connection issues
- Performance problems with real data

**Mitigation:**
- Start with service tests (smallest scope)
- Use test database with seed data
- Implement in small batches
- Have rollback plan for each test file

---

### Medium Risk Actions

#### Action 3: ML Integration (Risk: 6/10)
**Risks:**
- Cross-service communication failures
- Timeout issues
- ML service availability

**Mitigation:**
- Implement circuit breaker pattern
- Add comprehensive error handling
- Create mock responses as fallback
- Extensive integration testing

#### Action 4: Mobile Integration (Risk: 5/10)
**Risks:**
- API contract mismatches
- Authentication issues
- Network error handling

**Mitigation:**
- Test each screen incrementally
- Keep mock data as fallback initially
- Implement retry logic
- Add loading states

---

## 6. Success Metrics & Validation

### Technical Metrics
- ✅ All 12 API routes active and responding
- ✅ Test coverage ≥ 60% (real code, not mocks)
- ✅ All tests passing in CI/CD
- ✅ Mobile app connects to all endpoints
- ✅ ML service deployed and accessible
- ✅ Response times < 500ms (p95)

### Functional Metrics
- ✅ User can complete full workflow:
  1. Onboarding → Select pattern
  2. Dashboard → View recommendations
  3. Inventory → Track items
  4. Shopping → Create list
  5. Prep → Schedule tasks
  6. Analytics → View insights
  7. Ads → Upload and match deals

### Business Metrics
- ✅ Live demo available at Railway URL
- ✅ API documentation complete
- ✅ Demo video recorded
- ✅ README updated with deployment info

---

## 7. Implementation Timeline

### Week 1: Backend Foundation (12 hours)
**Mon-Tue:** Activate existing routes
- Uncomment 5 routes in server.ts
- Test each endpoint
- Fix any import/export issues

**Wed-Thu:** Create missing routes
- ads.routes.ts (proxy to ML)
- templates.routes.ts
- prices.routes.ts
- deals.routes.ts

**Fri:** ML integration
- Create ML client
- Add error handling
- Test integration

**Deliverable:** All 12 API routes active

---

### Week 2: Frontend Connection (11 hours)
**Mon-Wed:** Connect mobile screens
- Dashboard
- Inventory
- Shopping
- Prep
- Analytics
- Ads

**Thu-Fri:** Deploy ML service
- Configure Railway
- Deploy Python service
- Verify endpoints

**Deliverable:** Mobile app fully functional with API

---

### Week 3-4: Testing Overhaul (16 hours)
**Week 3:** Unit & Service tests
- Refactor service tests
- Add database test setup
- Remove mocks

**Week 4:** Integration & E2E tests
- API integration tests
- User flow tests
- Performance tests

**Deliverable:** 60%+ test coverage with real code

---

### Week 5: Polish & Launch (12 hours)
**Mon-Wed:** E2E testing
- User journey testing
- Bug fixes
- Performance optimization

**Thu-Fri:** Documentation
- API docs
- User guide
- Demo video
- Update README

**Deliverable:** Production-ready system with demo

---

## 8. Resource Requirements

### Human Resources (Single Developer)
- **Backend skills:** TypeScript, Express, PostgreSQL
- **Frontend skills:** React Native, Redux
- **ML skills:** Python, FastAPI (minimal, just integration)
- **DevOps skills:** Docker, Railway (basic)

**Total Time:** 51 hours sequential, 35-40 hours with task switching

---

### With Team (Parallel Execution)
**Backend Developer (1):** Weeks 1-2 (23h)
**Mobile Developer (1):** Week 2 (11h)
**Test Engineer (1):** Weeks 3-4 (16h)
**DevOps Engineer (0.5):** Week 2 (3h)
**Technical Writer (0.5):** Week 5 (4h)

**Total Duration:** 3-4 weeks with team
**Total Duration:** 5-6 weeks solo

---

## 9. Quick Wins (First 8 Hours)

### Day 1 Morning (4 hours): Activate Routes
1. Edit `server.ts` (30 min)
   - Uncomment 5 route imports
   - Uncomment 5 route mounts
2. Test each route (2h)
   - Use Postman/curl
   - Verify responses
3. Fix any issues (1.5h)

**Impact:** API completion 33% → 75%

---

### Day 1 Afternoon (4 hours): Create Ad Routes
1. Create `ads.routes.ts` (2h)
   - Proxy to ML service
   - Basic CRUD operations
2. Test endpoints (1h)
3. Mount in server.ts (1h)

**Impact:** Core ad functionality unlocked

---

## 10. Contingency Plans

### If ML Integration Fails
**Fallback:** Use mock responses
- Create mock data for ML endpoints
- Return static recommendations
- Log requests for later processing

**Time Added:** +4 hours to create mocks

---

### If Test Refactoring Takes Too Long
**Fallback:** Focus on critical paths
- Prioritize auth, patterns, meals
- Defer analytics, ads tests
- Accept 40% coverage initially

**Time Saved:** -8 hours

---

### If Mobile Integration Breaks
**Fallback:** Deploy API-only
- Focus on backend completion
- Provide Postman collection
- Document API for future mobile work

**Time Saved:** -8 hours

---

## 11. Next Immediate Steps

### Today (Hour 1-4)
1. **Open `src/api/server.ts`**
2. **Uncomment lines 21-28** (route imports)
3. **Uncomment lines 72-79** (route mounts)
4. **Run:** `npm run build && npm start`
5. **Test:** Each endpoint with curl/Postman
6. **Fix:** Any import/export errors

### Expected Issues
- Missing dependencies: `npm install`
- TypeScript errors: Check service exports
- Database errors: Verify migrations

### Success Criteria
- Server starts without errors
- 9/12 routes return 401 (auth required) or data
- No import/compilation errors

---

## 12. Long-Term Maintenance

### After Completion
1. **Monitor:** Railway logs for errors
2. **Update:** Dependencies monthly
3. **Backup:** Database weekly
4. **Test:** CI/CD runs on every commit
5. **Document:** New features as added

### Technical Debt to Address Later
- Improve test coverage to 80%+
- Add caching layer (Redis)
- Implement rate limiting per user
- Add comprehensive logging
- Create admin dashboard

---

## Conclusion

The meal_assistant project is **75% complete** with solid infrastructure and most features implemented. The primary gaps are:

1. **Route activation** (2 hours) - Quick win
2. **ML integration** (4 hours) - Medium complexity
3. **Mobile connection** (8 hours) - Straightforward
4. **Test refactoring** (16 hours) - Most time-consuming
5. **Documentation** (4 hours) - Low complexity

**Recommended Approach:** Follow the week-by-week timeline above, starting with the "Quick Wins" to show immediate progress. The project can be production-ready in 5-6 weeks solo, or 3-4 weeks with a small team.

**Biggest Leverage Point:** Action 1 (Activate Existing Routes) takes only 2 hours but unlocks 5 major features instantly.

**Critical Path:** Actions 1→2→3→4→5 must be sequential, but within each action, work can be parallelized for faster completion.
