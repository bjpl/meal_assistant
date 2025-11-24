# Ad System User Acceptance Test Scenarios
## Week 3-4 Feature Validation

**Document Version:** 1.0
**Created:** November 23, 2025
**Status:** PRE-IMPLEMENTATION (scenarios defined, pending feature development)

---

## Overview

This document defines User Acceptance Test (UAT) scenarios for the Week 3-4 Ad Processing System. These scenarios should be executed once implementation is complete to validate all user workflows function correctly.

---

## UAT Scenario 1: First Ad Upload (New User)

### Preconditions
- User is authenticated
- User has no previous ad uploads
- User has no store templates

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to Shopping tab | Shopping screen displays | PENDING |
| 2 | Tap "Add Weekly Ads" button | Ad upload modal opens | PENDING |
| 3 | Select "Take Photo" option | Camera opens | PENDING |
| 4 | Capture ad first page | Photo captured, preview shown | PENDING |
| 5 | Confirm photo | Upload starts, progress indicator shows | PENDING |
| 6 | Wait for processing | Processing progress updates (0% -> 100%) | PENDING |
| 7 | Review extracted deals | Deal list displays with LOW confidence badges | PENDING |
| 8 | Note: First upload accuracy ~30% | Many items need correction | EXPECTED |
| 9 | Tap item with wrong price | Edit modal opens | PENDING |
| 10 | Correct price to actual value | Price updates, "Learning..." indicator shows | PENDING |
| 11 | Repeat corrections for 5+ items | System logs corrections for learning | PENDING |
| 12 | Tap "Done Reviewing" | Deals matched to shopping list | PENDING |
| 13 | View shopping list | Deal badges appear on matched items | PENDING |
| 14 | Verify deal savings shown | Dollar amount and percentage displayed | PENDING |

### Expected Outcomes
- Ad successfully uploaded and processed
- OCR extracts ~30% of deals correctly (first time)
- User can correct mistakes
- Corrections feed into learning system
- Matched deals appear in shopping list with appropriate confidence levels

### Acceptance Criteria
- [ ] Upload completes in <30 seconds
- [ ] Processing completes in <10 seconds per page
- [ ] At least 30% of deals correctly identified
- [ ] Correction workflow is intuitive (<3 taps per correction)
- [ ] Deal badges display correctly in shopping list

---

## UAT Scenario 2: Template Training (Returning User)

### Preconditions
- User has uploaded 3+ ads from same store
- System has learned some patterns
- Previous accuracy: ~30-40%

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload new ad from familiar store | Store automatically identified | PENDING |
| 2 | Wait for processing | Processing faster due to template | PENDING |
| 3 | Review extracted deals | More items have MEDIUM confidence | PENDING |
| 4 | Count corrections needed | Fewer corrections than first upload | PENDING |
| 5 | Navigate to "Template Manager" | List of store templates shown | PENDING |
| 6 | Select the store template | Template details displayed | PENDING |
| 7 | View accuracy metrics | Shows improvement trend (30% -> 50%) | PENDING |
| 8 | View "Learn More" option | Annotation interface available | PENDING |
| 9 | Use annotation tool | Point-and-click to identify deal regions | PENDING |
| 10 | Save template improvements | Template version incremented | PENDING |
| 11 | Upload another ad from same store | Higher accuracy achieved | PENDING |

### Expected Outcomes
- Store recognized automatically from logo/format
- Template matching improves extraction accuracy
- User can view and improve templates
- Accuracy improves with each upload (target: 50% by Week 2)

### Acceptance Criteria
- [ ] Store identified correctly in >80% of cases
- [ ] Processing time improved by 20% with template
- [ ] Accuracy improved by 10-20 percentage points
- [ ] Template annotation tool is usable
- [ ] Version history tracked correctly

---

## UAT Scenario 3: High Accuracy Processing (Mature User)

### Preconditions
- User has 5+ weeks of ad history for a store
- Template accuracy: >80%
- System has learned user's common items

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload weekly ad from trained store | Store identified immediately | PENDING |
| 2 | Processing completes | Very fast processing (<5s) | PENDING |
| 3 | Review extracted deals | Most items have HIGH confidence | PENDING |
| 4 | Count items needing correction | <15% need correction | PENDING |
| 5 | Auto-match to shopping list | High-confidence deals auto-applied | PENDING |
| 6 | View "Auto-Applied Deals" summary | Shows savings without manual work | PENDING |
| 7 | Verify deal quality | Prices accurate, dates correct | PENDING |
| 8 | Navigate to Analytics | Accuracy metrics shown | PENDING |
| 9 | View accuracy trend chart | Shows progression 30% -> 85%+ | PENDING |
| 10 | Check savings calculation | Weekly savings estimate displayed | PENDING |

### Expected Outcomes
- Near-automatic deal processing
- High confidence enables auto-application
- Minimal user intervention required
- Clear visibility into savings achieved

### Acceptance Criteria
- [ ] Processing time <5 seconds
- [ ] Accuracy >85% for trained stores
- [ ] <5 corrections needed per ad
- [ ] Auto-apply works for high-confidence deals
- [ ] Savings calculation accurate within 5%

---

## UAT Scenario 4: Error Handling (Upload Failure)

### Preconditions
- User is authenticated
- Network connectivity may be unstable

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Start ad upload | Upload begins | PENDING |
| 2 | Simulate network interruption | Upload pauses/retries | PENDING |
| 3 | Observe error handling | User-friendly error message shown | PENDING |
| 4 | Tap "Retry" button | Upload resumes from checkpoint | PENDING |
| 5 | Complete upload successfully | Processing continues normally | PENDING |
| 6 | Upload corrupted/invalid file | Validation error shown | PENDING |
| 7 | Observe error message | Clear explanation of issue | PENDING |
| 8 | Upload oversized file (>10MB) | Size limit warning shown | PENDING |
| 9 | Upload unsupported format | Format error with supported list | PENDING |

### Expected Outcomes
- Graceful error handling for all failure modes
- Clear, actionable error messages
- Retry capability for transient failures
- No data loss or corruption

### Acceptance Criteria
- [ ] All errors have user-friendly messages
- [ ] Retry works for network failures
- [ ] File validation prevents bad uploads
- [ ] No crashes or frozen states
- [ ] Partial uploads can resume

---

## UAT Scenario 5: Multi-Store Ad Processing

### Preconditions
- User has 3+ favorite stores
- User has weekly ads from multiple stores
- Shopping list has items across stores

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload ad from Store A (Costco) | Store A identified | PENDING |
| 2 | Upload ad from Store B (Safeway) | Store B identified | PENDING |
| 3 | Upload ad from Store C (Walmart) | Store C identified | PENDING |
| 4 | View combined deal list | Deals from all stores shown | PENDING |
| 5 | Filter by store | Correct filtering applied | PENDING |
| 6 | View shopping list with deals | Best deal per item highlighted | PENDING |
| 7 | Item with deals at multiple stores | Compare prices option shown | PENDING |
| 8 | Tap compare prices | Side-by-side comparison displayed | PENDING |
| 9 | Select best deal | Item assigned to optimal store | PENDING |
| 10 | View store distribution | Items optimally distributed | PENDING |

### Expected Outcomes
- Multiple store ads processed independently
- Deals correctly attributed to stores
- Best deals highlighted across stores
- Price comparison enables optimal decisions

### Acceptance Criteria
- [ ] Store identification works for 5+ stores
- [ ] Deals correctly linked to source ad
- [ ] Best price highlighted in shopping list
- [ ] Comparison view is clear and useful
- [ ] Store assignment updates correctly

---

## UAT Scenario 6: Template Sharing

### Preconditions
- User has well-trained template (>80% accuracy)
- Community sharing is enabled

### Test Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to Template Manager | Template list shown | PENDING |
| 2 | Select high-accuracy template | Template details displayed | PENDING |
| 3 | Tap "Share with Community" | Share confirmation dialog | PENDING |
| 4 | Confirm sharing | Template published to repository | PENDING |
| 5 | View "Community Templates" tab | List of shared templates | PENDING |
| 6 | Find template for new store | Template available | PENDING |
| 7 | Tap "Download Template" | Template downloaded | PENDING |
| 8 | Upload ad for new store | Pre-trained template applied | PENDING |
| 9 | Verify accuracy improvement | Higher accuracy than fresh start | PENDING |

### Expected Outcomes
- Users can share successful templates
- Community templates accelerate new store training
- Downloaded templates improve accuracy immediately
- Privacy preserved (no personal data shared)

### Acceptance Criteria
- [ ] Template export/import works correctly
- [ ] No personal data in shared templates
- [ ] Downloaded templates improve accuracy
- [ ] Community repository accessible
- [ ] Template versioning preserved

---

## Test Data Requirements

### Test Ad Files
1. Single-page PDF ad (simple layout)
2. Multi-page PDF ad (3-5 pages)
3. High-resolution JPG scan
4. Low-quality phone photo
5. Multiple column layout
6. Special characters in prices
7. Non-English ad (future)

### Test Stores
1. Costco - warehouse format
2. Safeway - circular format
3. Walmart - rollback format
4. Whole Foods - organic format
5. Target - category format

### Test Shopping Lists
1. Empty list (no matches expected)
2. Partial match list (50% overlap)
3. Full match list (100% overlap)
4. Large list (50+ items)

---

## Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Upload time | <30s for 5MB file | Stopwatch from tap to completion |
| OCR processing | <10s per page | Server-side timing |
| Deal matching | <2s for 50 items | Client-side timing |
| Template matching | <1s | Server-side timing |
| UI responsiveness | 60fps | Performance profiler |

---

## Known Limitations (Pre-Implementation)

1. **OCR Accuracy**: First-time accuracy limited to ~30%
2. **Handwritten Ads**: Not supported
3. **Complex Layouts**: May require manual correction
4. **International Formats**: English only initially
5. **Real-time Prices**: Captured at scan time, may change

---

## Sign-Off Requirements

### Functional Sign-Off
- [ ] All 6 UAT scenarios pass
- [ ] No P0/P1 bugs in ad flow
- [ ] Performance targets met

### Quality Sign-Off
- [ ] Code review completed
- [ ] Security review completed
- [ ] Accessibility review completed

### User Sign-Off
- [ ] Real user tested workflow
- [ ] Feedback incorporated
- [ ] Documentation complete

---

*Document Status: DRAFT - Pending Implementation*
*Last Updated: November 23, 2025*
