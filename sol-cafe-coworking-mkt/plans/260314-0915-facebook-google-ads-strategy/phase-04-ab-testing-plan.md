# Giai đoạn 4: Kế Hoạch A/B Testing Chi Tiết

## Bối cảnh
- **Mục tiêu:** Tối ưu hóa hiệu quả quảng cáo qua testing có hệ thống
- **Phương pháp:** Scientific A/B testing với sample size đủ lớn
- **Thời gian:** Testing liên tục, tối ưu hóa hàng tuần

---

## 1. Framework Testing

### 1.1 Test Structure

#### Testing Hierarchy
```
Level 1: Platform Test (Facebook vs. Google)
Level 2: Format Test (Video vs. Image vs. Carousel)
Level 3: Creative Test (Headline, Image, CTA)
Level 4: Audience Test (Demographics, Interests)
Level 5: Placement Test (Feed vs. Story vs. Reel)
```

#### Testing Principles
- **One variable at a time:** Chỉ test 1 yếu tố mỗi lần
- **Statistical significance:** Sample size đủ lớn (min. 1,000 impressions)
- **Duration:** 7-14 ngày/test (tránh quá ngắn hoặc quá dài)
- **Budget allocation:** 50/50 split cho A/B test
- **Confidence interval:** 95% confidence level

---

## 2. Monthly Testing Calendar

### Month 1: Foundation Testing

#### Week 1-2: Creative Test - Headlines
**Variable:** Headline copy

**Variations:**
- **A (Control):** "Coworking Space Cầu Giấy - WiFi Tốc Độ Cao"
- **B (Test):** "Tăng 200% Năng Suất Làm Việc Ngay Hôm Nay"

**Metrics:**
- Primary: CTR, CPC
- Secondary: Conversion rate, CPA

**Hypothesis:** Benefit-focused headline (B) sẽ outperform feature-focused (A)

**Budget:** 2M VND (1M per variation)
**Sample size:** Min. 2,000 impressions per variation

---

#### Week 3-4: Creative Test - Images
**Variable:** Primary image type

**Variations:**
- **A (Control):** Wide shot of workspace
- **B (Test):** Person working in space (human element)

**Metrics:**
- Primary: Engagement rate, CPC
- Secondary: Click-through rate, conversion rate

**Hypothesis:** Human element (B) sẽ tạo emotional connection tốt hơn

**Budget:** 2M VND (1M per variation)
**Sample size:** Min. 2,000 impressions per variation

---

### Month 2: Format Testing

#### Week 1-2: Format Test - Ad Format
**Variable:** Ad format

**Variations:**
- **A (Control):** Carousel ads (5 cards)
- **B (Test):** Video ads (30 seconds)

**Metrics:**
- Primary: CPC, Conversion rate
- Secondary: Video completion rate (for B)

**Hypothesis:** Video (B) sẽ có CPC cao hơn nhưng conversion rate tốt hơn

**Budget:** 4M VND (2M per variation)
**Sample size:** Min. 5,000 impressions per variation

---

#### Week 3-4: CTA Test
**Variable:** Call-to-action button

**Variations:**
- **A (Control):** "Learn More"
- **B (Test):** "Sign Up"
- **C (Test):** "Get Quote"

**Metrics:**
- Primary: Click-through rate
- Secondary: Conversion rate, lead quality

**Hypothesis:** Direct CTA "Sign Up" (B) sẽ có conversion rate cao hơn

**Budget:** 3M VND (1M per variation)
**Sample size:** Min. 1,500 clicks per variation

---

### Month 3: Audience Testing

#### Week 1-2: Age Group Test
**Variable:** Target age range

**Variations:**
- **A (Control):** 25-45 (broad)
- **B (Test):** 25-35 (younger)
- **C (Test):** 35-45 (older)

**Metrics:**
- Primary: CPC, Conversion rate
- Secondary: Lead quality, CPA

**Hypothesis:** 25-35 (B) sẽ có CPC thấp hơn, 35-45 (C) sẽ có conversion rate tốt hơn

**Budget:** 4.5M VND (1.5M per variation)
**Sample size:** Min. 2,000 impressions per variation

---

#### Week 3-4: Interest Test
**Variable:** Interest targeting

**Variations:**
- **A (Control):** Coworking + Freelancing interests
- **B (Test):** Startup + Entrepreneurship interests
- **C (Test):** Productivity + Remote work interests

**Metrics:**
- Primary: CPC, Conversion rate, Lead quality
- Secondary: Engagement rate

**Hypothesis:** Startup/Entrepreneurship (B) sẽ có lead quality tốt nhất

**Budget:** 4.5M VND (1.5M per variation)
**Sample size:** Min. 2,000 impressions per variation

---

### Month 4-6: Advanced Testing

#### Platform Comparison Test
**Variable:** Advertising platform

**Variations:**
- **A:** Facebook Ads (50% budget)
- **B:** Google Search Ads (30% budget)
- **C:** Google Display Ads (20% budget)

**Metrics:**
- Primary: CPA, ROAS
- Secondary: Lead quality, Conversion rate

**Hypothesis:** Facebook sẽ có CPL thấp nhất, Google Search sẽ có lead quality tốt nhất

**Budget:** Proportional allocation based on hypothesis

---

#### Placement Test (Facebook/Instagram)
**Variable:** Ad placement

**Variations:**
- **A:** Feed only
- **B:** Stories only
- **C:** Feed + Stories (Advantage+)

**Metrics:**
- Primary: CPC, Conversion rate
- Secondary: Reach, Engagement

**Hypothesis:** Feed + Stories (C) sẽ scale tốt nhất

---

#### Duration Test (Video Ads)
**Variable:** Video length

**Variations:**
- **A:** 15 seconds
- **B:** 30 seconds
- **C:** 60 seconds

**Metrics:**
- Primary: Video completion rate, CPC
- Secondary: Conversion rate, CPA

**Hypothesis:** 30s (B) sẽ có balance tốt nhất giữa completion rate và conversion

---

## 3. Test Variables Matrix

### 3.1 Creative Variables

#### Headline Testing
| Variable | Option A | Option B | Option C | Hypothesis |
|----------|----------|----------|----------|------------|
| Focus | Feature | Benefit | Question | Benefit wins |
| Length | Short (25 chars) | Medium (40 chars) | Long (60 chars) | Medium wins |
| Tone | Professional | Casual | Urgent | Professional wins |
| Format | Statement | Question | Emoji | Statement wins |

#### Image Testing
| Variable | Option A | Option B | Hypothesis |
|----------|----------|----------|------------|
| Subject | Space only | Person in space | Person wins |
| Style | Professional | Candid | Candid wins |
| Color | Warm | Cool | Warm wins |
| Angle | Wide shot | Close-up | Close-up wins |

#### Copy Testing
| Variable | Option A | Option B | Hypothesis |
|----------|----------|----------|------------|
| Length | Short (50 chars) | Long (125 chars) | Short wins |
| Tone | Professional | Friendly | Friendly wins |
| Structure | Problem-solution | Feature list | Problem-solution wins |
| Emoji | Yes | No | Yes wins |

---

### 3.2 Audience Variables

#### Demographics
| Variable | Option A | Option B | Hypothesis |
|----------|----------|----------|------------|
| Age | 25-35 | 35-45 | 25-35 wins CPC, 35-45 wins conversion |
| Gender | All | Female 60% | All wins (broad) |
| Location | Cầu Giấy (3km) | Hanoi (10km) | Cầu Giấy wins conversion |

#### Interests
| Variable | Option A | Option B | Hypothesis |
|----------|----------|----------|------------|
| Focus | Coworking | Startup | Startup wins quality |
| Breadth | Narrow (3 interests) | Broad (10+ interests) | Narrow wins CPC |
| Type | Hobby | Professional | Professional wins conversion |

#### Behaviors
| Variable | Option A | Option B | Hypothesis |
|----------|----------|----------|------------|
| Device | Mobile only | All devices | All wins scale |
| Engagement | Page engagers | Website visitors | Website visitors wins |

---

### 3.3 Format Variables

#### Ad Format
| Format | Pros | Cons | Best For |
|--------|------|------|----------|
| Carousel | Multiple features | More production work | Awareness |
| Video | High engagement | Higher CPC | Consideration |
| Single Image | Simple | Limited storytelling | Retargeting |
| Stories | Full screen | Disappears quickly | Younger audience |

#### Video Length
| Length | Completion Rate | Conversion Rate | Best For |
|--------|------------------|-----------------|----------|
| 6s | High | Low | Awareness |
| 15s | Medium-High | Medium | Consideration |
| 30s | Medium | Medium-High | Conversion |
| 60s | Low | High | Retargeting |

---

## 4. Sample Size Calculator

### Minimum Sample Sizes

#### For CTR Testing (Facebook)
- **Minimum impressions per variation:** 2,000
- **Minimum clicks per variation:** 50
- **Confidence level:** 95%
- **Minimum detectable effect:** 20%

**Formula:**
```
Required impressions = (16 × p × (1-p)) / (Δ²)
Where p = baseline CTR (e.g., 0.02 for 2%)
Where Δ = minimum detectable effect (e.g., 0.004 for 0.4%)
```

#### For Conversion Rate Testing
- **Minimum clicks per variation:** 500
- **Minimum conversions per variation:** 25
- **Confidence level:** 95%
- **Minimum detectable effect:** 30%

#### For CPA Testing
- **Minimum conversions per variation:** 50
- **Test duration:** 14 days minimum
- **Confidence level:** 90%

---

## 5. Statistical Significance Guide

### When to Declare a Winner

#### Clear Winner (Stop Test)
- **Confidence level:** ≥ 95%
- **Sample size:** Reached minimum
- **Duration:** At least 7 days
- **Performance:** ≥ 20% improvement

#### Continue Testing
- **Confidence level:** 80-94%
- **Sample size:** Below minimum
- **Duration:** Less than 7 days
- **Performance:** 10-19% improvement

#### Inconclusive (Re-test)
- **Confidence level:** < 80%
- **Duration:** 14+ days
- **Performance:** < 10% difference

### Statistical Tools
- **Facebook:** Built-in A/B testing tool
- **Google:** Experiments (draft experiments)
- **Third-party:** Optimizely, VWO (if needed)
- **Manual:** Chi-square test calculator

---

## 6. Testing Documentation

### Test Log Template

```markdown
## Test: [Test Name]
**Date:** [Start Date] - [End Date]
**Hypothesis:** [Clear statement]
**Variable:** [What changed]
**Control:** [Description of A]
**Test:** [Description of B]

**Metrics:**
| Metric | Control | Test | Lift | Significance |
|--------|---------|------|------|--------------|
| Impressions | 2,500 | 2,500 | - | - |
| Clicks | 75 | 95 | +26.7% | 92% |
| CTR | 3.0% | 3.8% | +26.7% | 94% |
| Conversions | 8 | 12 | +50% | 88% |
| CPA | 125K | 83K | -33.6% | 91% |

**Winner:** Test variant
**Action:** Scale winning variant, pause loser
**Learnings:** [Key insights]
**Next test:** [Related test idea]
```

---

## 7. Optimization Cadence

### Weekly Tasks
- **Monday:** Review last week's test results
- **Tuesday:** Launch new tests based on learnings
- **Wednesday:** Monitor mid-week performance
- **Thursday:** Make minor bid/creative adjustments
- **Friday:** Pause underperforming ads
- **Weekend:** Monitor (no major changes)

### Monthly Tasks
- **Week 1:** Strategic planning - What to test next
- **Week 2-3:** Execute testing plan
- **Week 4:** Analyze cumulative learnings, update creative library

### Quarterly Tasks
- **Full account audit**
- **Creative refresh - New images, videos**
- **Audience expansion - New lookalikes**
- **Budget reallocation based on performance**

---

## 8. Multi-Armed Bandit Strategy

### When to Use
- **High budget (30M+/month)**
- **Fast learning needed**
- **Multiple variables to test simultaneously**

### Implementation
- **Start:** 20% budget exploration, 80% exploitation
- **After 2 weeks:** 10% exploration, 90% exploitation
- **After 1 month:** 5% exploration, 95% exploitation

### Budget Split for Bandit
| Variant | Week 1 | Week 2 | Week 3 | Week 4 |
|---------|--------|--------|--------|--------|
| A (Control) | 40% | 50% | 60% | 70% |
| B (Test 1) | 30% | 30% | 25% | 20% |
| C (Test 2) | 30% | 20% | 15% | 10% |

---

## 9. Testing Pitfalls to Avoid

### Common Mistakes
1. **Testing too many variables at once** → Hard to isolate cause
2. **Stopping tests too early** → False positives
3. **Ignoring sample size** → Inconclusive results
4. **Testing without hypothesis** → Wasted budget
5. **Not documenting learnings** → Repeat mistakes
6. **Focusing on wrong metrics** → Optimize for vanity, not business
7. **Seasonality effects** → Test vs. test comparison issues

### Seasonality Considerations
- **Holidays:** Tết, summer, year-end
- **Events:** Startup events, tech conferences
- **Weather:** Rainy season (more indoor work)
- **School year:** Students in/out

**Solution:** Always compare to baseline, run tests during similar periods

---

## 10. Success Metrics for Testing Program

### Program-Level KPIs
- **Tests completed:** 4-6 tests/month
- **Win rate:** 30-40% (tests with clear winner)
- **Average improvement:** 15-25% lift per winning test
- **Testing budget:** 15-20% of total ad spend
- **Time to insight:** 7-14 days per test

### Compound Effect
- **Month 1-3:** Baseline + 10-15% improvement
- **Month 4-6:** Baseline + 25-40% improvement
- **Month 7-12:** Baseline + 50-80% improvement

**Example:**
- Starting CPA: 200K VND
- After 3 months: 170K VND (15% improvement)
- After 6 months: 140K VND (30% improvement)
- After 12 months: 110K VND (45% improvement)

---

## 11. Testing Roadmap

### Q1 2026 (Month 1-3): Foundation
- Establish baseline metrics
- Test core creative elements
- Identify winning audiences
- Build learning library

### Q2 2026 (Month 4-6): Optimization
- Scale winning combinations
- Test advanced formats
- Refine targeting
- Improve CPA 20-30%

### Q3 2026 (Month 7-9): Advanced
- Multi-variable testing
- Platform optimization
- Seasonal adjustments
- Improve CPA 40-50%

### Q4 2026 (Month 10-12): Mastery
- Predictive optimization
- Automated testing
- Full account maturity
- Improve CPA 50-80% vs baseline

---

**Document Status:** ✅ Complete
**Last Updated:** 14/03/2026
**Next Review:** 21/03/2026
**Testing Lead:** [Assign team member]
**Review Frequency:** Weekly
