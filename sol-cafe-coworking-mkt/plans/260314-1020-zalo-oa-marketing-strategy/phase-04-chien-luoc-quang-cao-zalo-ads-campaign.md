# PHASE 4: CHIẾN LƯỢC QUẢNG CÁO ZALO ADS CAMPAIGN
## Sol Cafe Coworking - 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội

---

## CONTEXT LINKS
- [Plan tổng quan](./plan.md)
- [Phase 3: Content Strategy](./phase-03-chien-luoc-noi-dung-30-ngay-content-calendar.md)
- [Bảng giá dịch vụ](../../docs/bang-gia-dich-vu-thue-mat-binh-su-kien-sol-cafe-coworking.md)

---

## OVERVIEW

**Priority:** 🟡 MEDIUM (High for growth)

**Current Status:** Pending

**Description:** Thiết kế và chạy 3-5 campaign Zalo Ads targeting các segment khách hàng khác nhau (sinh viên, doanh nghiệp SME, người dạy học) để tăng followers, traffic, và bookings.

---

## KEY INSIGHTS

### Tại sao Zalo Ads hiệu quả?

1. **Targeting chính xác:** Location (Cầu Giấy + 3km), demographics, interests
2. **Cost-effective:** CPC thấp hơn Facebook 30-40%
3. **High intent:** User trên Zalo có tâm lý "mua sắm/service" cao
4. **Native integration:** Ads blend với organic content → Higher CTR
5. **Direct action:** Click → Chat/Call ngay lập tức

### Zalo Ads Formats

| Format | Mô tả | CPC trung bình | Conversion rate | Khuyên dùng |
|--------|-------|----------------|-----------------|-------------|
| **Text + Image** | Static ad với text | 2.000-4.000đ | 3-5% | ✅ Awareness |
| **Carousel** | 2-5 images swipeable | 3.000-5.000đ | 4-6% | ⭐ BEST CHOICE |
| **Video** | Short video 15-30s | 4.000-7.000đ | 5-8% | ⭐ High engagement |
| **Story Ads** | Full-screen vertical | 3.000-6.000đ | 6-9% | ⚠️ Nâng cao |
| **Lead Form** | Direct lead capture | 5.000-8.000đ | 8-12% | ⭐ Conversion |

**Lựa chọn:** **Carousel + Video** (Balanced awareness + conversion)

### Target Segments cho Sol Cafe

1. **Sinh viên (40% budget)**
   - Location: Cầu Giấy + 5km
   - Age: 18-24
   - Interests: Education, Events, Workshops, Student clubs
   - Behaviors: Active on weekends, price-sensitive

2. **Doanh nghiệp SME (35% budget)**
   - Location: Cầu Giấy + 3km
   - Age: 25-45
   - Interests: Business, Leadership, Team building, Corporate events
   - Job titles: Manager, HR, Founder, CEO

3. **Người dạy học (25% budget)**
   - Location: Hà Nội wide
   - Age: 25-50
   - Interests: Teaching, Education, Training, Online courses
   - Behaviors: Search for "venue training", "classroom rental"

---

## REQUIREMENTS

### Functional Requirements

1. **Campaign Structure:** 3-5 campaigns với rõ objectives
2. **Ad Sets:** 2-3 ad sets per campaign (different targeting)
3. **Ad Creatives:** 3-5 variations per ad set (A/B testing)
4. **Landing Destinations:** Zalo OA, Chatbot, Booking form
5. **Tracking:** Zalo Analytics + Google Analytics (website)
6. **Budget Management:** Daily budget caps, bid adjustments

### Non-Functional Requirements

1. **Compliance:** Follow Zalo Ads policies (no prohibited content)
2. **Brand Safety:** Ads appear on appropriate placements
3. **Performance:** Ads load fast (< 3s), mobile-optimized
4. **Scalability:** Ready to increase budget on winners
5. **Monitoring:** Daily check, weekly optimization

---

## ARCHITECTURE

### Campaign Hierarchy

```
Account: Sol Cafe Coworking Zalo Ads
│
├─ CAMPAIGN 1: AWARENESS - Student Segment (40% budget)
│   ├─ AD SET 1.1: Female students, NEU/FTU/UEH
│   │   ├─ AD 1.1.1: Carousel - Workshop space
│   │   ├─ AD 1.1.2: Video - Student testimonial
│   │   └─ AD 1.1.3: Image - Student discount
│   │
│   └─ AD SET 1.2: Male students, Tech communities
│       ├─ AD 1.2.1: Carousel - Tech meetup space
│       └─ AD 1.2.2: Video - Hackathon venue
│
├─ CAMPAIGN 2: CONSIDERATION - SME Segment (35% budget)
│   ├─ AD SET 2.1: HR Managers, Cầu Giấy businesses
│   │   ├─ AD 2.1.1: Carousel - Team building venue
│   │   ├─ AD 2.1.2: Video - Corporate event setup
│   │   └─ AD 2.1.3: Lead Form - Get quote
│   │
│   └─ AD SET 2.2: Startup founders, Tech companies
│       ├─ AD 2.2.1: Carousel - Product launch venue
│       └─ AD 2.2.2: Image - Startup-friendly space
│
└─ CAMPAIGN 3: CONVERSION - Teacher Segment (25% budget)
    ├─ AD SET 3.1: Soft skills trainers
    │   ├─ AD 3.1.1: Carousel - Training room
    │   └─ AD 3.1.2: Video - Class in session
    │
    └─ AD SET 3.2: Language/Programming teachers
        ├─ AD 3.2.1: Image - Classroom rental
        └─ AD 3.2.2: Lead Form - Book class space
```

### Ad Funnel Strategy

```
AWARENESS (Top of Funnel)
    ↓
Objective: Reach, Followers
Budget: 30%
Ad Format: Video, Carousel
CTA: "Follow Zalo OA"
    ↓
CONSIDERATION (Middle of Funnel)
    ↓
Objective: Traffic, Engagement
Budget: 40%
Ad Format: Carousel, Story
CTA: "Learn More", "View Gallery"
    ↓
CONVERSION (Bottom of Funnel)
    ↓
Objective: Leads, Bookings
Budget: 30%
Ad Format: Lead Form, Click-to-Chat
CTA: "Book Now", "Get Quote"
```

---

## RELATED CODE FILES

### Files to Create
1. `resources/zalo-ads-campaign-structures.md` - Detailed campaign setup
2. `resources/ad-creative-templates.md` - Ad copy và image templates
3. `resources/targeting-options.md` - Audience targeting research
4. `resources/ads-testing-framework.md` - A/B testing methodology

### Files to Modify
- Không có files cần modify

### Files to Delete
- Không có files cần delete

---

## IMPLEMENTATION STEPS

### Step 1: Account Setup (Day 43-44)

**Create Zalo Ads Account:**

1. **Access Zalo Ads**
   - Go: ads.zalo.me
   - Login với Zalo OA account
   - Create Ads Account (nếu chưa có)

2. **Payment Method**
   - Add payment method (Credit card/Transfer)
   - Set billing threshold (e.g., 5 triệu)
   - Enable auto-recharge (optional)

3. **Install Tracking Pixel**
   - Get Zalo Pixel code
   - Install on website (header)
   - Test pixel firing
   - Configure conversion events (booking, quote request)

### Step 2: Audience Research (Day 45-46)

**Segment 1: Sinh viên**

```
TARGETING OPTIONS:
- Location: Cầu Giấy + 5km radius
- Age: 18-24
- Gender: All (test split female vs male)
- Education: University student
- Interests:
  * "Workshop"
  * "Sự kiện sinh viên"
  * "Hội thảo"
  * "CLB"
  * "Offline"
- Behaviors:
  * Engaged with educational content
  * Active on weekends
- EXCLUDE: Already followers of Zalo OA

ESTIMATED AUDIENCE SIZE: 50.000-80.000 people

MESSAGE ANGLE: "Giá sinh viên thân thiện", "Không gian trẻ trung", "Gần trường đại học"
```

**Segment 2: Doanh nghiệp SME**

```
TARGETING OPTIONS:
- Location: Cầu Giấy + 3km radius
- Age: 25-45
- Gender: All
- Job Titles:
  * "Manager"
  * "HR Manager"
  * "CEO"
  * "Founder"
  * "Business Owner"
- Company Size: 10-100 employees
- Interests:
  * "Team building"
  * "Sự kiện doanh nghiệp"
  * "Corporate training"
  * "Kick-off"
- Behaviors:
  * Business decision makers
  * Event planners

ESTIMATED AUDIENCE SIZE: 15.000-25.000 people

MESSAGE ANGLE: "Professional space", "Full equipment", "Competitive pricing for corporate"
```

**Segment 3: Người dạy học**

```
TARGETING OPTIONS:
- Location: Hà Nội wide (teachers travel)
- Age: 25-50
- Gender: All
- Interests:
  * "Giáo dục"
  * "Đào tạo"
  * "Teaching"
  * "Lớp học"
  * "Khóa học"
  * "Workshop"
- Behaviors:
  * Search for "cho thuê lớp học"
  * Search for "địa điểm đào tạo"
  * Engaged with educational content

ESTIMATED AUDIENCE SIZE: 30.000-50.000 people

MESSAGE ANGLE: "Classroom rental", "Training venue", "Flexible booking", "Student-friendly environment"
```

### Step 3: Create Ad Creatives (Day 47-50)

**Campaign 1: Student Segment - Carousel Ad**

**Ad Creative 1.1: Workshop Space Showcase**

```
FORMAT: Carousel (5 cards)

CARD 1:
- Image: Panoramic ground floor, students in workshop
- Headline: "📍 Không gian workshop tại Cầu Giấy - Giá sinh viên!"
- Description: "Cho thuê mặt bằng sự kiện từ 500K. Máy chiếu, âm thanh full."
- Button: "Xem bảng giá"

CARD 2:
- Image: Private room setup
- Headline: "🎓 Phòng riêng cho CLB, workshop nhỏ"
- Description: "10-15 người, thoải mái thảo luận. Giảm 15% cho sinh viên."
- Button: "Đặt lịch"

CARD 3:
- Image: Equipment flat lay (projector, sound)
- Headline: "🎤 Full equipment: Máy chiếu 4K, âm thanh crystal"
- Description: "Không cần chuẩn bị gì, có sẵn hết!"
- Button: "Tiện ích"

CARD 4:
- Image: Group photo of student event
- Headline: "⭐ 50+ CLB sinh viên đã tin tưởng"
- Description: "NEU, FTU, UEH, Bách Khoa... đều tổ chức tại Sol!"
- Button: "Xem feedback"

CARD 5:
- Image: Price table graphic
- Headline: "💰 Giá từ 500K - 1.8K tùy quy mô"
- Description: "Giảm thêm 10% khi đặt trước 7 ngày."
- Button: "Nhận báo giá"

PRIMARY TEXT:
"Bạn đang tìm không gian tổ chức workshop cho CLB?

Sol Cafe Coworking tại Cầu Giấy có không gian rộng, full equipment, giá siêu sinh viên!

📍 Địa chỉ: 181 Trần Quốc Vượng, Cầu Giấy
💰 Giá: 500K - 1.8K (đã giảm 15% cho sinh viên)
✅ Tiện ích: Máy chiếu, âm thanh, wifi, điều hòa

🎁 ƯU ĐÃI ĐẶC BIỆT:
- Giảm 10% khi đặt trước 7 ngày
- Free nước uống cho mỗi người
- Tặng 1 giờ setup

👉 Nhắn tin ngay để nhận báo giá chi tiết!"

CALL-TO-ACTION: "Send Message"

HASHTAGS: #WorkshopCauGiay #ThueSuKien #SinhVien #CLB #EventVenueHanoi
```

**Ad Creative 1.2: Video Testimonial**

```
FORMAT: Video (15-30 seconds)

SCRIPT:
[0-3s] Hook: Student speaking to camera
"CLB mình vừa tổ chức workshop tại Sol Cafe, không gian siêu đẹp!"

[3-10s] Body: B-roll of event
"20 người comfort, máy chiếu 4K, âm thanh nghe rõ từng chữ. Giá lại hợp lý nữa!"

[10-15s] Social proof: Group photo
"Có 50+ CLB sinh viên đã tổ chức tại Sol rồi. NEU, FTU, UEH... đều có!"

[15-20s] CTA: Booking info
"Giá sinh viên chỉ từ 500K. Đặt trước 7 ngày giảm thêm 10%!"

[20-30s] Final CTA: Logo + Contact
"📍 181 Trần Quốc Vượng, Cầu Giấy
📞 Hotline: [SĐT]"

CAPTION:
"Workshop thành công tại Sol Cafe! 🎉

Không gian đẹp, equipment full, giá sinh viên siêu thiện.

👉 Nhắn tin để nhận báo giá ngay!"

BUTTON: "Send Message"
```

**Campaign 2: SME Segment - Lead Form Ad**

```
FORMAT: Lead Form (Click-to-Convert)

HEADLINE IMAGE: Corporate event setup (professional lighting)

HEADLINE: "Professional Event Space for Your Team"

PRIMARY TEXT:
"Need a professional space for your next team building or corporate event?

Sol Cafe Coworking offers:
✅ 50-person capacity venue
✅ Full AV equipment (Projector 4K, Premium sound)
✅ High-speed WiFi & Climate control
✅ Convenient location: Cầu Giấy district
✅ Competitive pricing: From 1M - 3.8M

Perfect for:
- Team Building & Team Gathering
- Product Launches
- Corporate Training
- Kick-off Meetings
- Client Meetings

🎁 CORPORATE OFFER:
- 10% off for first-time bookings
- Free tea break for events >20 people
- Flexible scheduling

GET A FREE QUOTE NOW ↓"

LEAD FORM FIELDS:
1. Company Name (Text)
2. Contact Person (Text)
3. Phone Number (Phone)
4. Email (Email)
5. Event Type (Dropdown: Team Building, Training, Meeting, Other)
6. Expected Date (Date picker)
7. Number of Attendees (Number)
8. Additional Requirements (Textarea)

CALL-TO-ACTION: "Get Free Quote"

THANK YOU MESSAGE:
"Thank you for your interest!

Our team will contact you within 24 hours with a detailed quote.

For urgent inquiries:
📞 Hotline: [SĐT]
📍 Visit us: 181 Trần Quốc Vượng, Cầu Giấy"
```

**Campaign 3: Teacher Segment - Single Image Ad**

```
FORMAT: Single Image + Text

IMAGE: Bright classroom with whiteboard, students taking notes

HEADLINE: "Rent a Training Room - Flexible & Affordable"

PRIMARY TEXT:
"Are you a soft skills trainer, language teacher, or workshop facilitator?

Sol Cafe Coworking has the perfect space for your next class!

📚 WHAT WE OFFER:
- Quiet, professional environment
- Natural lighting & Comfortable seating
- Whiteboard & Projector included
- High-speed WiFi
- Flexible booking (hourly, half-day, full-day)
- Capacity: 10-40 people

💰 COMPETITIVE PRICING:
- Hourly: From 200K
- Half-day (4h): From 700K
- Full-day (8h): From 1.2M
- Monthly packages available (save up to 25%)

✅ PERFECT FOR:
- Soft skills training
- Language classes (English, Japanese, Korean...)
- Programming workshops
- Personal development seminars
- Test prep courses

🎁 TEACHER SPECIAL:
- 15% off first booking
- Free storage for teaching materials
- Priority booking for recurring classes

👉 MESSAGE NOW TO CHECK AVAILABILITY"

CALL-TO-ACTION: "Send Message"

HASHTAGS: #ClassroomRental #TrainingVenue #TeacherHanoi #RentAClassroom #WorkshopSpace
```

### Step 4: Campaign Setup (Day 51-53)

**Campaign 1: Awareness - Students**

```
CAMPAIGN SETTINGS:
- Campaign Name: "Awareness - Students - Cau Giay"
- Objective: "Reach" (Brand awareness)
- Budget: 4.000.000đ/day (120 triệu/month)
- Duration: 30 days
- Schedule: Mon-Fri, 17:00-21:00 (peak student hours)

AD SET 1.1: Female Students
- Audience: Female, 18-24, Cầu Giấy + 5km, University
- Budget: 2.000.000đ/day
- Placement: Zalo Feed + Zalo Stories
- Bid Strategy: Lowest cost

AD SET 1.2: Male Students
- Audience: Male, 18-24, Cầu Giấy + 5km, University
- Budget: 2.000.000đ/day
- Placement: Zalo Feed + Zalo Stories
- Bid Strategy: Lowest cost
```

**Campaign 2: Consideration - SME**

```
CAMPAIGN SETTINGS:
- Campaign Name: "Consideration - SME - Corporate"
- Objective: "Traffic" (Send messages to OA)
- Budget: 3.500.000đ/day (105 triệu/month)
- Duration: 30 days
- Schedule: Mon-Fri, 9:00-17:00 (business hours)

AD SET 2.1: HR Managers
- Audience: 25-45, Cầu Giấy + 3km, Job: HR/Manager
- Budget: 1.750.000đ/day
- Placement: Zalo Feed
- Bid Strategy: Lowest cost

AD SET 2.2: Business Owners
- Audience: 28-50, Cầu Giấy + 3km, Job: CEO/Founder/Owner
- Budget: 1.750.000đ/day
- Placement: Zalo Feed
- Bid Strategy: Lowest cost
```

**Campaign 3: Conversion - Teachers**

```
CAMPAIGN SETTINGS:
- Campaign Name: "Conversion - Teachers - Hanoi"
- Objective: "Leads" (Lead form submissions)
- Budget: 2.500.000đ/day (75 triệu/month)
- Duration: 30 days
- Schedule: Mon-Sun, 10:00-20:00 (flexible)

AD SET 3.1: Soft Skills Trainers
- Audience: 25-50, Hà Nội wide, Interest: Teaching/Training
- Budget: 1.250.000đ/day
- Placement: Zalo Feed
- Bid Strategy: Lowest cost

AD SET 3.2: Language Teachers
- Audience: 25-50, Hà Nội wide, Interest: Language education
- Budget: 1.250.000đ/day
- Placement: Zalo Feed
- Bid Strategy: Lowest cost
```

### Step 5: Launch & Monitor (Day 54-60)

**Day 1-3: Learning Phase**

- Do NOT make changes (let algorithm learn)
- Monitor: Impressions, CTR, CPC
- Check: Ads are delivering, no errors
- Prepare: Optimizations based on data

**Day 4-7: Initial Optimization**

- Pause worst-performing ads (CTR < 2%)
- Increase budget on best performers (CTR > 5%)
- Adjust targeting if audience too narrow/broad
- Test new creative variations

**Day 8-14: Scale Winners**

- Allocate 70% budget to winning ad sets
- Pause bottom 20% performers
- Create 2-3 new ad variations to test
- A/B test headlines, CTAs

**Day 15-30: Ongoing Optimization**

- Weekly performance review
- Rotate creative (new images/videos)
- Expand winning audiences (lookalike)
- Test new placements (Stories, Articles)

### Step 6: Reporting & Analysis (Weekly + Monthly)

**Daily Metrics to Track:**

```
PERFORMANCE METRICS:
- Impressions
- Reach
- CTR (Click-Through Rate)
- CPC (Cost Per Click)
- CPM (Cost Per 1,000 Impressions)

CONVERSION METRICS:
- Messages received
- Lead form submissions
- Booking requests
- Cost Per Lead (CPL)
- Cost Per Acquisition (CPA)

ENGAGEMENT METRICS:
- Likes
- Comments
- Shares
- Followers gained
```

**Weekly Report Template:**

```
WEEKLY ZALO ADS PERFORMANCE REPORT
Week of: [Date Range]

CAMPAIGN PERFORMANCE:
┌────────────────────────────────────────────┐
│ Campaign │ Spend │ Impressions │ CTR │ Leads │ CPL │
├────────────────────────────────────────────┤
│ Awareness│ 2.8M  │ 145K       │ 4.2%│ 45   │ 62K │
│ Consider.│ 2.5M  │ 98K        │ 5.1%│ 32   │ 78K │
│ Convers.│ 1.8M  │ 62K        │ 6.8%│ 18   │ 100K│
└────────────────────────────────────────────┘

TOP PERFORMING ADS:
1. Ad Name: [Best ad]
   - CTR: 7.2%
   - Leads: 15
   - CPL: 55K

2. Ad Name: [2nd best]
   - CTR: 6.5%
   - Leads: 12
   - CPL: 68K

OPTIMIZATIONS MADE:
- Paused 2 low-performing ads (CTR < 2%)
- Increased budget on Ad Set 1.1 (+30%)
- Tested new headline for Campaign 2
- Adjusted targeting for Ad Set 3.1

NEXT WEEK ACTIONS:
- Scale winning ad sets by 20%
- Test 3 new ad creatives
- Expand lookalike audience
- Implement conversion pixel improvements

QUESTIONS/ISSUES:
- [List any issues or questions]
```

---

## TODO LIST

### Week 7-10 (25/04 - 22/05)

**Week 7: Setup & Launch (Day 43-49)**

- [ ] **Day 43-44:** Account setup
  - [ ] Create Zalo Ads account
  - [ ] Add payment method
  - [ ] Install tracking pixel
  - [ ] Test pixel firing

- [ ] **Day 45-46:** Audience research
  - [ ] Define targeting options for 3 segments
  - [ ] Estimate audience sizes
  - [ ] Create custom audiences (if data available)
  - [ ] Document targeting strategy

- [ ] **Day 47-50:** Create ad creatives
  - [ ] Design 5 carousel ads (students)
  - [ ] Create 2 video ads (testimonial)
  - [ ] Write copy for all ads
  - [ ] Create lead form (SME)
  - [ ] Design 3 single image ads (teachers)

- [ ] **Day 51-53:** Campaign setup
  - [ ] Create 3 campaigns in Ads Manager
  - [ ] Set up ad sets with targeting
  - [ ] Upload ad creatives
  - [ ] Set budgets and schedules
  - [ ] QA check all settings

**Week 8: Launch & Learn (Day 54-60)**

- [ ] **Day 54:** Launch all campaigns
  - [ ] Enable campaigns
  - [ ] Monitor first 2 hours
  - [ ] Fix any errors immediately

- [ ] **Day 55-56:** Learning phase (no changes)
  - [ ] Monitor impressions, CTR, CPC
  - [ ] Check ads are delivering
  - [ ] Document observations

- [ ] **Day 57-60:** Initial optimization
  - [ ] Pause worst-performing ads (CTR < 2%)
  - [ ] Increase budget on winners (CTR > 5%)
  - [ ] Adjust targeting if needed
  - [ ] Test 2-3 new variations

**Week 9: Scale & Optimize (Day 61-67)**

- [ ] **Day 61-63:** Analyze Week 1 performance
  - [ ] Generate weekly report
  - [ ] Identify winning ad sets
  - [ ] Plan scaling strategy

- [ ] **Day 64-67:** Scale winners
  - [ ] Allocate 70% budget to winners
  - [ ] Pause bottom 20% performers
  - [ ] Create 2-3 new ad variations
  - [ ] Test new placements

**Week 10: Ongoing Management (Day 68-75)**

- [ ] **Day 68-71:** Continue optimization
  - [ ] Daily performance checks
  - [ ] Adjust bids/budgets
  - [ ] Rotate creative
  - [ ] A/B test new elements

- [ ] **Day 72-75:** Monthly review
  - [ ] Generate monthly report
  - [ ] Analyze ROI by campaign
  - [ ] Identify learnings
  - [ ] Plan Month 2 strategy

---

## SUCCESS CRITERIA

### Definition of Done
1. ✅ 3 campaigns launched (Awareness, Consideration, Conversion)
2. ✅ 5-7 ad sets per campaign with different targeting
3. ✅ 15-20 ad creatives tested (variations)
4. ✅ Tracking pixel installed and firing
5. ✅ Daily monitoring workflow in place

### KPIs for Phase 4

| Metric | Week 1 | Week 2 | Week 3 | Week 4 | Target |
|--------|--------|--------|--------|--------|--------|
| **Total spend** | 10M | 10M | 10M | 10M | 40M/month |
| **Impressions** | 300K | 350K | 400K | 450K | 1.5M/month |
| **CTR** | 3.5% | 4.2% | 4.8% | 5.2% | 4%+ |
| **Leads generated** | 50 | 70 | 90 | 110 | 320/month |
| **Cost Per Lead** | 200K | 143K | 111K | 91K | <150K |
| **Bookings from ads** | 5 | 8 | 12 | 15 | 40/month |
| **ROI** | - | 2.5x | 3.2x | 3.8x | 3x+ |

---

## RISK ASSESSMENT

### Potential Issues

**Risk 1: CPC quá cao, không sustainable**
- **Nguyên nhân:** Competition cao, targeting quá narrow
- **Mitigation:** Broaden targeting, test different placements, adjust bid strategy
- **Contingency:** Pause campaign, reassess targeting, increase budget gradually

**Risk 2: Low CTR (< 2%)**
- **Nguyên nhân:** Creative không吸引, audience mismatch
- **Mitigation:** A/B test creatives rapidly, refresh images/videos
- **Contingency:** Pivot messaging, test new value propositions

**Risk 3: High CPL (> 200K)**
- **Nguyên nhân:** Landing page not converting, form too long
- **Mitigation:** Optimize lead form, test fewer fields
- **Contingency:** Shift to "Send Message" CTA instead of lead form

**Risk 4: Ads disapproved**
- **Nguyên nhân:** Violate Zalo Ads policies (copyright, prohibited content)
- **Mitigation:** Review policies carefully, use original content
- **Contingency:** Resubmit with revisions, appeal if wrongly flagged

**Risk 5: Budget burn too fast**
- **Nguyên nhân:** Bid too high, competition unexpected
- **Mitigation:** Set daily budget caps, monitor spend hourly initially
- **Contingency:** Pause campaigns, reduce bids, reallocate budget

---

## NEXT STEPS

### Dependencies
- Phase 4 cần Phase 3 content ready (use top posts as ads)
- Need tracking pixel installed on website before launch

### Follow-up Tasks
1. **After Phase 4:** Bắt đầu Phase 5 - Mini App (convert ad traffic easier)
2. **Month 2:** Scale winning campaigns, expand audiences
3. **Month 3:** Test retargeting campaigns (website visitors, engagers)
4. **Ongoing:** Weekly optimization, monthly strategy review

---

## COST BREAKDOWN

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| **Zalo Ads budget** | 40.000.000đ/tháng | 3 campaigns x ~13M each |
| **Creative production** | 3.000.000đ | Design images, edit videos |
| **Tracking setup** | 500.000đ | Pixel installation, testing |
| **Management time** | 2.000.000đ | Daily monitoring, optimization |
| **Total** | **45.500.000đ/tháng** | ~45-50 triệu/tháng |

**ROI Target:** 3x (Spend 50M → Generate 150M in bookings)

---

## TEMPLATES & RESOURCES

### Ad Copy Templates

See: `./resources/zalo-ads-ad-copy-templates.md`

### Campaign Structure Sheet

See: `./resources/zalo-ads-campaign-setup-checklist.md`

### Weekly Report Template

See: `./resources/zalo-ads-weekly-report-template.md`

---

## QUESTIONS & CLARIFICATIONS

### Unresolved Questions

1. **Monthly budget:** Confirm budget allocation (40M/tháng hoặc different?)
2. **Attribution model:** How to track bookings from ads? (Phone tracking, promo codes?)
3. **Creative resources:** In-house designer or outsource ad creatives?
4. **Lead management:** Who follows up on leads? Response time SLA?
5. **Seasonality:** Any seasonal trends to consider (exam periods, holidays)?

---

**Người lập:** AI Planner Agent
**Ngày tạo:** 14/03/2026
**Deadline:** 22/05/2026 (38 days)
**Status:** Pending approval

---
