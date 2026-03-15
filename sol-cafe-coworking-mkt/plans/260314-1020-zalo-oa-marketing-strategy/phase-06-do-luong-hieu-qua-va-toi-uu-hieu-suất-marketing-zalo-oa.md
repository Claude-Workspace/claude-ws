# PHASE 6: ĐO LƯỜNG HIỆU QUẢ VÀ TỐI ƯU HIỆU SUẤT MARKETING ZALO OA
## Sol Cafe Coworking - 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội

---

## CONTEXT LINKS
- [Plan tổng quan](./plan.md)
- [Phase 1-5: Implementation phases](./phase-01-thiet-lap-zalo-official-account.md)
- [Chương trình khách hàng thân thiết](../../docs/chuong-trinh-khach-hang-than-thiet-cho-dich-vu-thue-su-kien-tai-sol-cafe-coworking-181-tran-quoc-vuong-cau-giay-ha-noi.md)

---

## OVERVIEW

**Priority:** 🔵 LOW (Critical for long-term success)

**Current Status:** Pending

**Description:** Thiết lập hệ thống đo lường, tracking, và reporting để đánh giá hiệu quả của toàn bộ chiến dịch Zalo OA marketing, từ đó tối ưu và scale chiến dịch hiệu quả.

---

## KEY INSIGHTS

### Tại sao Measurement & Optimization quan trọng?

1. **Data-driven decisions:** Dựa trên số liệu thực tế thay vì cảm tính
2. **ROI clarity:** Biết chính xác campaigned mang lại bao nhiêu doanh thu
3. **Continuous improvement:** Tìm ra điểm yếu và cải thiện liên tục
4. **Budget optimization:** Dồn tiền vào kênh/campaign hiệu quả nhất
5. **Scalability:** Scale những gì hiệu quả, cut những gì không hiệu quả

### Measurement Framework

**Stage 1: Awareness Metrics** (Top of Funnel)
- Followers growth rate
- Reach & Impressions
- Content engagement rate
- Share of voice (vs competitors)

**Stage 2: Consideration Metrics** (Middle of Funnel)
- Message conversations started
- Chatbot completion rate
- Content saves/shares
- Website traffic from Zalo OA

**Stage 3: Conversion Metrics** (Bottom of Funnel)
- Booking leads generated
- Conversion rate (lead → booking)
- Cost Per Acquisition (CPA)
- Revenue attribution

**Stage 4: Retention Metrics** (Post-purchase)
- Customer repeat rate
- Lifetime Value (LTV)
- Referral rate
- Satisfaction score

### Tools cho Measurement

| Tool | Purpose | Cost | Level |
|------|---------|------|-------|
| **Zalo OA Analytics** | Built-in metrics | Miễn phí | Basic |
| **Google Analytics** | Website traffic | Miễn phí | Intermediate |
| **Zalo Ads Manager** | Ads performance | Miễn phí | Advanced |
| **Google Sheets** | Custom dashboards | Miễn phí | Basic |
| **Looker Studio** | Visual dashboards | Miễn phí | Advanced |
| **Mixpanel/Amplitude** | User behavior tracking | $0-100/tháng | Pro |

**Lựa chọn:** **Zalo OA Analytics + Google Sheets + Looker Studio** (Free combo)

---

## REQUIREMENTS

### Functional Requirements

1. **Tracking Setup:**
   - Zalo OA Analytics configured
   - UTM parameters for all links
   - Conversion tracking (pixel, events)
   - Lead source attribution

2. **Data Collection:**
   - Automatic data sync (daily)
   - Manual data entry (offline bookings)
   - Customer feedback collection
   - Competitor monitoring

3. **Reporting:**
   - Daily dashboards (real-time)
   - Weekly performance reports
   - Monthly executive summaries
   - Ad-hoc analysis requests

4. **Optimization:**
   - A/B testing framework
   - Experiment tracking
   - Winner identification
   - Scaling recommendations

### Non-Functional Requirements

1. **Data accuracy:** 95%+ accuracy rate
2. **Timeliness:** Reports available within 24h
3. **Accessibility:** Stakeholders can access self-service
4. **Scalability:** Handle increased data volume
5. **Actionability:** Insights lead to clear actions

---

## ARCHITECTURE

### Data Flow Architecture

```
[DATA SOURCES]
    ├── Zalo OA Analytics (followers, engagement)
    ├── Zalo Ads Manager (impressions, clicks, leads)
    ├── Mini App Analytics (bookings, payments)
    ├── Google Analytics (website traffic)
    ├── Manual Entries (offline bookings, phone calls)
    ├── Customer Feedback (surveys, reviews)
    └── Competitor Data (social listening)
    ↓
[DATA COLLECTION LAYER]
    ├── Zalo API (auto-sync)
    ├── Google Sheets API (manual entry)
    ├── Webhooks (real-time events)
    └── Scheduled Tasks (daily batch)
    ↓
[DATA STORAGE]
    ├── Google Sheets (raw data)
    ├── Google BigQuery (data warehouse - optional)
    └── Looker Studio Data Sources
    ↓
[DATA PROCESSING]
    ├── Data cleaning & normalization
    ├── Calculations (CPA, ROI, LTV)
    ├── Aggregations (daily, weekly, monthly)
    └── Anomaly detection
    ↓
[VISUALIZATION & REPORTING]
    ├── Looker Studio Dashboards (real-time)
    ├── Google Sheets Reports (weekly)
    ├── Email Alerts (threshold breaches)
    └── Slack Notifications (team updates)
    ↓
[OPTIMIZATION ACTIONS]
    ├── Budget reallocation
    ├── Content adjustments
    ├── Campaign optimizations
    └── Strategic pivots
```

### Dashboard Hierarchy

```
EXECUTIVE DASHBOARD (Owner/Manager)
├── Key Metrics: Total Bookings, Revenue, ROI
├── Budget Utilization vs. Target
├── Month-over-Month Growth
└── Strategic Recommendations

MARKETING DASHBOARD (Marketing Team)
├── Channel Performance (Zalo OA, Ads, Mini App)
├── Campaign Performance (all active campaigns)
├── Content Performance (top/bottom posts)
├── Audience Insights (demographics, behaviors)
└── A/B Test Results

OPERATIONS DASHBOARD (Staff)
├── Daily Bookings (today, this week)
├── Lead Response Time
├── Booking Capacity Utilization
├── Customer Satisfaction Score
└── Action Items (follow-ups, confirmations)

FINANCE DASHBOARD (Finance/Accounting)
├── Revenue Breakdown (by channel, by event type)
├── Cost Breakdown (ads, tools, staff time)
├── Profit & Loss (ROI by campaign)
├── Cash Flow (bookings vs. payments)
└── Forecast (next month, next quarter)
```

---

## RELATED CODE FILES

### Files to Create
1. `resources/tracking-setup-guide.md` - Pixel, UTM, conversion tracking
2. `resources/dashboard-templates/` - Looker Studio templates
3. `resources/weekly-report-template.md` - Standardized report format
4. `resources/optimization-playbook.md` - Actionable optimization strategies

### Files to Modify
- Không có files cần modify

### Files to Delete
- Không có files cần delete

---

## IMPLEMENTATION STEPS

### Step 1: Tracking Setup (Day 96-98)

**Zalo OA Analytics Configuration:**

```
CHECKLIST:
□ Enable Zalo OA Analytics
□ Set up follower growth tracking
□ Configure message tracking
□ Set up content performance tracking
□ Enable visitor demographics
□ Create custom UTM parameters for links
```

**UTM Parameter Standards:**

```
FORMAT: utm_source=zalo&utm_medium=oapost&utm_content=[post_type]&utm_campaign=[campaign_name]

EXAMPLES:
- Zalo OA post: utm_source=zalo&utm_medium=oapost&utm_content=space_showcase&utm_campaign=march_awareness
- Zalo Ads: utm_source=zalo&utm_medium=ads&utm_content=carousel_student&utm_campaign=student_acquisition
- Chatbot link: utm_source=zalo&utm_medium=chatbot&utm_content=booking_flow&utm_campaign=conversion
```

**Conversion Tracking Setup:**

```javascript
// Example: Track booking completion
// Mini App or Chatbot

function trackBookingCompleted(bookingData) {
  // Zalo Pixel event
  zalo.track('BookingCompleted', {
    value: bookingData.total_amount,
    currency: 'VND',
    content_type: bookingData.event_type,
    content_id: bookingData.booking_id,
    num_items: bookingData.guest_count
  });

  // Google Analytics event
  gtag('event', 'purchase', {
    transaction_id: bookingData.booking_id,
    affiliation: 'Zalo OA',
    value: bookingData.total_amount,
    currency: 'VND',
    items: [{
      item_name: bookingData.event_type,
      quantity: 1,
      price: bookingData.total_amount
    }]
  });
}
```

### Step 2: Data Collection System (Day 99-101)

**Google Sheets Setup:**

**Sheet 1: Daily Performance Log**

```
Columns:
A: Date
B: Followers (Start of day)
C: New Followers
D: Total Followers (End of day)
E: Posts Published
F: Total Impressions
G: Total Reach
H: Engagement Rate
I: Messages Received
J: Chatbot Conversations
K: Booking Leads
L: Completed Bookings
M: Revenue (Bookings)
N: Ad Spend
O: ROI
P: Notes

Row 1: Header
Row 2: 14/03/2026 (example)
Row 3: 15/03/2026
...
```

**Sheet 2: Campaign Performance**

```
Columns:
A: Campaign Name
B: Start Date
C: End Date
D: Total Budget
E: Actual Spend
F: Impressions
G: Clicks
H: CTR
I: CPC
J: Leads
K: Cost Per Lead
L: Conversions
M: Cost Per Acquisition
N: Revenue Attributed
O: ROI
P: Status (Active/Paused/Completed)

Row 1: Header
Row 2: Awareness-Students
Row 3: Consideration-SME
...
```

**Sheet 3: Content Performance**

```
Columns:
A: Post ID
B: Date Published
C: Content Type
D: Caption Preview
E: Impressions
F: Reach
G: Likes
H: Comments
I: Shares
J: Clicks to Website
K: Engagement Rate
L: Cost (if promoted)
M: Leads Generated
N: Revenue Attributed
O: ROI

Row 1: Header
Row 2: [Post 1 data]
Row 3: [Post 2 data]
...
```

**Automated Data Sync:**

```javascript
// Google Apps Script to auto-sync Zalo OA data

function syncZaloOAData() {
  // Fetch data from Zalo OA Analytics API
  const apiKey = 'YOUR_API_KEY';
  const oaId = 'YOUR_OA_ID';
  const url = `https://openapi.zalo.me/v2/analytics/oainfo?oa_id=${oaId}`;

  const response = UrlFetchApp.fetch(url, {
    headers: { 'access_token': apiKey }
  });

  const data = JSON.parse(response.getContentText());

  // Update Google Sheet
  const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getSheetByName('Daily Performance');
  const today = new Date();
  const row = sheet.getLastRow() + 1;

  sheet.getRange(row, 1).setValue(today); // Date
  sheet.getRange(row, 3).setValue(data.follower_count.diff); // New followers
  sheet.getRange(row, 6).setValue(data.total_impression); // Impressions
  // ... more fields
}
```

### Step 3: Dashboard Creation (Day 102-105)

**Looker Studio Dashboard Setup:**

**Dashboard 1: Executive Overview**

```
WIDGETS:
1. Scorecard: Total Revenue This Month
   - Data: Google Sheets (Daily Performance, sum of Column M)
   - Comparison: vs Last Month

2. Scorecard: Total Bookings This Month
   - Data: Google Sheets (Daily Performance, sum of Column L)
   - Comparison: vs Last Month

3. Scorecard: ROI (All Channels)
   - Data: Google Sheets (Daily Performance, avg of Column O)
   - Target: > 3x

4. Time Series: Revenue Trend (Last 30 days)
   - Chart: Line chart
   - Data: Google Sheets (Daily Performance, Column M)

5. Pie Chart: Revenue by Event Type
   - Data: Google Sheets (Booking Details)
   - Breakdown: Workshop, Team Building, Sinh Nhật, Lớp Học

6. Bar Chart: Channel Performance
   - Data: Google Sheets (Campaign Performance)
   - Metrics: Revenue Attributed
   - Channels: Zalo OA Organic, Zalo Ads, Mini App, Referral
```

**Dashboard 2: Marketing Performance**

```
WIDGETS:
1. Scorecard: Follower Growth Rate
   - Data: Google Sheets (Daily Performance)
   - Formula: (New Followers / Total Followers) * 100

2. Scorecard: Engagement Rate
   - Data: Google Sheets (Daily Performance)
   - Formula: (Likes + Comments + Shares) / Reach

3. Scorecard: Cost Per Lead (CPL)
   - Data: Google Sheets (Campaign Performance)
   - Aggregation: Weighted average across campaigns

4. Table: Top Performing Content
   - Data: Google Sheets (Content Performance)
   - Sorted by: Engagement Rate (descending)
   - Columns: Content Type, Engagement Rate, Leads, ROI

5. Bar Chart: Campaign Comparison
   - Data: Google Sheets (Campaign Performance)
   - X-axis: Campaign Name
   - Y-axis: ROI

6. Time Series: Ad Spend vs. Revenue
   - Chart: Dual-axis line chart
   - Left axis: Ad Spend
   - Right axis: Revenue
```

**Dashboard 3: Operations**

```
WIDGETS:
1. Scorecard: Today's Bookings
   - Data: Google Sheets (Daily Performance)
   - Filter: Today

2. Scorecard: Average Lead Response Time
   - Data: Manual entry or Mini App data
   - Target: < 30 minutes

3. Gauge: Capacity Utilization
   - Data: Calendar system
   - Formula: (Booked Hours / Available Hours) * 100

4. Table: Upcoming Bookings
   - Data: Booking system
   - Columns: Date, Time, Event Type, Customer, Status

5. Scorecard: Customer Satisfaction
   - Data: Post-event surveys
   - Metric: Average rating (1-5)
```

### Step 4: Reporting Framework (Day 106-108)

**Weekly Report Template:**

```markdown
# ZALO OA WEEKLY PERFORMANCE REPORT
Week: [Date Range]

## 📊 EXECUTIVE SUMMARY
- **Total Bookings:** [X] ([+/- X]% vs last week)
- **Revenue:** [X]M ([+/- X]% vs last week)
- **Ad Spend:** [X]M (ROI: [X]x)
- **Key Win:** [Top achievement this week]
- **Key Challenge:** [Main issue this week]

---

## 🎯 KEY METRICS

### Growth Metrics
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Followers | [X] | [X] | [+/- X%] |
| Impressions | [X]K | [X]K | [+/- X%] |
| Reach | [X]K | [X]K | [+/- X%] |
| Engagement Rate | [X]% | [X]% | [+/- X%] |

### Conversion Metrics
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Messages Received | [X] | [X] | [+/- X%] |
| Booking Leads | [X] | [X] | [+/- X%] |
| Completed Bookings | [X] | [X] | [+/- X%] |
| Conversion Rate | [X]% | [X]% | [+/- X%] |
| Cost Per Lead | [X]K | [X]K | [+/- X%] |
| Cost Per Acquisition | [X]K | [X]K | [+/- X%] |

### Financial Metrics
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Revenue (Bookings) | [X]M | [X]M | [+/- X%] |
| Ad Spend | [X]M | [X]M | [+/- X%] |
| ROI | [X]x | [X]x | [+/- X%] |

---

## 📈 PERFORMANCE BREAKDOWN

### By Channel
| Channel | Bookings | Revenue | Ad Spend | ROI |
|---------|----------|---------|----------|-----|
| Zalo OA Organic | [X] | [X]M | [X]M | [X]x |
| Zalo Ads - Student | [X] | [X]M | [X]M | [X]x |
| Zalo Ads - SME | [X] | [X]M | [X]M | [X]x |
| Mini App | [X] | [X]M | [X]M | [X]x |
| Referrals | [X] | [X]M | [X]M | [X]x |

### By Event Type
| Event Type | Bookings | Revenue | Avg. Order Value |
|------------|----------|---------|------------------|
| Workshop/Training | [X] | [X]M | [X]M |
| Team Building | [X] | [X]M | [X]M |
| Sinh Nhật/Tiệc | [X] | [X]M | [X]M |
| Lớp Học | [X] | [X]M | [X]M |

---

## 🏆 TOP PERFORMING CONTENT

1. **[Post Title/Type]**
   - Engagement Rate: [X]%
   - Leads Generated: [X]
   - Revenue Attributed: [X]M
   - ROI: [X]x

2. **[Post Title/Type]**
   - Engagement Rate: [X]%
   - Leads Generated: [X]
   - Revenue Attributed: [X]M
   - ROI: [X]x

3. **[Post Title/Type]**
   - Engagement Rate: [X]%
   - Leads Generated: [X]
   - Revenue Attributed: [X]M
   - ROI: [X]x

---

## ⚠️ UNDERPERFORMING AREAS

1. **[Campaign/Content Name]**
   - Issue: [Description]
   - Impact: [Revenue loss, opportunity cost]
   - Action Plan: [What to do]

2. **[Campaign/Content Name]**
   - Issue: [Description]
   - Impact: [Revenue loss, opportunity cost]
   - Action Plan: [What to do]

---

## 🔧 OPTIMIZATIONS MADE THIS WEEK

- [Optimization 1]: [Result]
- [Optimization 2]: [Result]
- [Optimization 3]: [Result]

---

## 📋 NEXT WEEK ACTIONS

1. **[Action Item 1]** - [Owner] - [Due Date]
2. **[Action Item 2]** - [Owner] - [Due Date]
3. **[Action Item 3]** - [Owner] - [Due Date]

---

## 💡 KEY INSIGHTS & LEARNINGS

- [Insight 1: What worked, what didn't]
- [Insight 2: Customer behavior observation]
- [Insight 3: Market trend]

---

## ❓ QUESTIONS & REQUESTS

- [Any questions, data requests, or clarifications needed]

---
**Report prepared by:** [Name]
**Date:** [Report Date]
**Next report:** [Next Report Date]
```

### Step 5: Optimization Framework (Day 109-112)

**A/B Testing Playbook:**

```
EXPERIMENT: [Test Name]

HYPOTHESIS:
[What you believe will happen]

VARIABLES:
- Control: [Original version]
- Variant: [New version to test]

SUCCESS METRICS:
- Primary: [Most important metric]
- Secondary: [Supporting metrics]

SAMPLE SIZE:
- [Minimum required for statistical significance]

DURATION:
- [Days/Weeks to run test]

RESULTS:
- Control Performance: [Metrics]
- Variant Performance: [Metrics]
- Statistical Significance: [P-value]
- Winner: [Control/Variant/Inconclusive]

IMPLEMENTATION:
- [Action taken based on results]
```

**Optimization Strategies:**

1. **Content Optimization**
   - Test: Content types, posting times, caption styles
   - Frequency: Weekly
   - Tools: Zalo OA Analytics

2. **Campaign Optimization**
   - Test: Targeting, ad creatives, bidding strategies
   - Frequency: Daily
   - Tools: Zalo Ads Manager

3. **Conversion Optimization**
   - Test: Booking flow, payment process, CTAs
   - Frequency: Bi-weekly
   - Tools: Mini App Analytics, Google Analytics

4. **Budget Optimization**
   - Action: Reallocate budget to best performers
   - Frequency: Weekly
   - Rule: Kill campaigns with ROI < 2x after 2 weeks

### Step 6: Maintenance & Continuous Improvement (Day 113+)

**Daily Tasks (15 min):**
- Check dashboards for anomalies
- Review booking leads
- Respond to urgent issues

**Weekly Tasks (2 hours):**
- Generate weekly report
- Analyze top/bottom performers
- Plan next week content/campaigns
- Execute 1-2 A/B tests

**Monthly Tasks (4 hours):**
- Comprehensive performance review
- Competitor analysis
- Strategic planning for next month
- System optimization & maintenance

**Quarterly Tasks (8 hours):**
- Full strategy review
- Budget reallocation
- Technology stack evaluation
- Team training & development

---

## TODO LIST

### Week 13 (06/06 - 14/06)

**Week 13: Setup & Launch (Day 96-105)**

- [ ] **Day 96-98:** Tracking setup
  - [ ] Enable Zalo OA Analytics
  - [ ] Set up UTM parameters
  - [ ] Install conversion tracking pixel
  - [ ] Test tracking implementation

- [ ] **Day 99-101:** Data collection
  - [ ] Create Google Sheets structure
  - [ ] Set up automated data sync
  - [ ] Train staff on manual data entry
  - [ ] Test data accuracy

- [ ] **Day 102-105:** Dashboard creation
  - [ ] Build Looker Studio dashboards (3 dashboards)
  - [ ] Connect data sources
  - [ ] Test real-time updates
  - [ ] Share with stakeholders

- [ ] **Day 106-108:** Reporting framework
  - [ ] Create report templates
  - [ ] Set up automated reports (email)
  - [ ] Train team on report interpretation
  - [ ] Test reporting workflow

- [ ] **Day 109-112:** Optimization framework
  - [ ] Document A/B testing process
  - [ ] Create optimization playbook
  - [ ] Run first A/B test
  - [ ] Document results

- [ ] **Day 113-114:** Final review & handoff
  - [ ] Full system test
  - [ ] Create user documentation
  - [ ] Train all users
  - [ ] Official launch

---

## SUCCESS CRITERIA

### Definition of Done
1. ✅ All tracking installed and verified (95%+ accuracy)
2. ✅ Dashboards accessible to all stakeholders
3. ✅ Automated reports running (weekly/monthly)
4. ✅ A/B testing framework operational
5. ✅ Team trained on data interpretation

### KPIs for Phase 6

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Data accuracy** | 95%+ | Random sample verification |
| **Report timeliness** | < 24h | Time from week-end to report delivery |
| **Dashboard usage** | 3+ views/week | Google Analytics tracking |
| **Optimization cycles** | 2+ tests/week | A/B test log |
| **ROI improvement** | +20% over 3 months | Month-over-month comparison |
| **Stakeholder satisfaction** | 4+ / 5 | Quarterly survey |

---

## RISK ASSESSMENT

### Potential Issues

**Risk 1: Data accuracy issues**
- **Nguyên nhân:** Manual entry errors, tracking failures
- **Mitigation:** Automated data collection, spot checks
- **Contingency:** Manual reconciliation weekly

**Risk 2: Information overload**
- **Nguyên nhân:** Too many metrics, unclear insights
- **Mitigation:** Focus on key metrics, actionable insights
- **Contingency:** Simplify reports, executive summaries

**Risk 3: Low adoption of dashboards**
- **Nguyên nhân:** Complex UI, lack of training
- **Mitigation:** Intuitive design, hands-on training
- **Contingency:** Email reports as backup

**Risk 4: Tracking privacy concerns**
- **Nguyên nhân:** Customer data collection compliance
- **Mitigation:** Follow data protection laws, transparent policy
- **Contingency:** Legal review, anonymization

---

## NEXT STEPS

### Dependencies
- Phase 6 cần tất cả các phase trước đã completed để có data

### Follow-up Tasks
1. **After Phase 6:** Review toàn bộ 3-month campaign
2. **Month 4-6:** Scale successful campaigns, enter new markets
3. **Month 7-12:** Expand to other channels (Facebook, Instagram, TikTok)
4. **Ongoing:** Continuous optimization based on data insights

---

## COST BREAKDOWN

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| **Tracking setup** | 500.000đ | UTM, pixel, analytics configuration |
| **Google Sheets setup** | 0đ | Free tools |
| **Looker Studio setup** | 0đ | Free tools |
| **Report templates** | 500.000đ | Design, automation scripts |
| **Training** | 1.000.000đ | Team training on data interpretation |
| **Maintenance** | 500.000đ/tháng | Ongoing monitoring, updates |
| **Total Setup** | **2.000.000đ** | One-time |
| **Ongoing** | **500.000đ/tháng** | Maintenance |

---

## TEMPLATES & RESOURCES

### Dashboard Templates

See: `./resources/looker-studio-dashboard-templates.md`

### Weekly Report Template

See: `./resources/weekly-performance-report-template.md`

### A/B Testing Framework

See: `./resources/ab-testing-playbook.md`

---

## QUESTIONS & CLARIFICATIONS

### Unresolved Questions

1. **Data access:** Who needs dashboard access? (Owner, Manager, Marketing, Operations)
2. **Reporting frequency:** Weekly reports sufficient hoặc need daily/real-time?
3. **KPI priorities:** Top 3 KPIs cho business? (Revenue, Bookings, ROI?)
4. **Attribution model:** How to attribute bookings to channels? (First touch, last touch, multi-touch?)
5. **Competitor tracking:** Want to monitor competitors? If so, which ones?

---

**Người lập:** AI Planner Agent
**Ngày tạo:** 14/03/2026
**Deadline:** 14/06/2026 (19 days)
**Status:** Pending approval

---
