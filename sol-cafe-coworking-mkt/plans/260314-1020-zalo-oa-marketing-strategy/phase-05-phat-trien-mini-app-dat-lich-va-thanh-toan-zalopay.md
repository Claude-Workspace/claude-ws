# PHASE 5: PHÁT TRIỂN MINI APP ĐẶT LỊCH VÀ THANH TOÁN ZALOPAY
## Sol Cafe Coworking - 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội

---

## CONTEXT LINKS
- [Plan tổng quan](./plan.md)
- [Phase 2: Chatbot](./phase-02-xay-dung-chatbot-tu-dong-24-7.md)
- [Phase 4: Zalo Ads](./phase-04-chien-luoc-quang-cao-zalo-ads-campaign.md)
- [Bảng giá dịch vụ](../../docs/bang-gia-dich-vu-thue-mat-binh-su-kien-sol-cafe-coworking.md)

---

## OVERVIEW

**Priority:** 🟢 LOW (Nice to have, accelerates conversion)

**Current Status:** Pending

**Description:** Phát triển Mini App trên Zalo cho phép khách hàng tự đặt lịch và thanh toán đặt cọc qua ZaloPay, giảm friction và tăng tỷ lệ chuyển đổi từ 15% lên 30%+.

---

## KEY INSIGHTS

### Tại sao cần Mini App?

1. **Self-service booking:** Khách đặt 24/7 không cần chờ nhân viên
2. **Faster conversion:** Thanh toán ngay → Xác nhận booking tức thì
3. **Reduced no-shows:** Thanh toán cọc giảm 80% no-show rate
4. **Better UX:** Native app experience within Zalo (smooth)
5. **Data capture:** Tự động collect và sync customer data

### Mini App vs Chatbot Booking

| Aspect | Chatbot Booking | Mini App Booking |
|--------|-----------------|------------------|
| **Speed** | 5-7 phút (conversations) | 2-3 phút (form) |
| **UX** | Linear flow | Visual, intuitive |
| **Payment** | External (bank transfer) | Native (ZaloPay) |
| **Real-time availability** | Manual check | Live calendar sync |
| **Conversion rate** | 10-15% | 25-35% |
| **Development cost** | Thấp (built-in) | Cao (custom) |
| **Maintenance** | Dễ | Phức tạp |

**Lựa chọn:** **Phase 1 dùng Chatbot, Phase 2 upgrade sang Mini App**

### ZaloPay Integration Benefits

1. **High adoption:** 80%+ Zalo users đã linked ZaloPay
2. **Instant confirmation:** Thanh toán → Confirm ngay lập tức
3. **Lower fees:** 1.1% transaction fee vs 2.9% PayPal
4. **Trust:** Users trust Zalo ecosystem
5. **Refund friendly:** Dễ hoàn tiền nếu hủy booking

---

## REQUIREMENTS

### Functional Requirements

1. **Booking Flow:**
   - Chọn loại sự kiện (Workshop, Team Building, Sinh Nhật...)
   - Chọn ngày (calendar view với available slots)
   - Chọn khung giờ (sáng/chiều/tối/cả ngày)
   - Chọn số lượng người (10-20 / 21-30 / 31-50)
   - Chọn dịch vụ thêm (máy chiếu, teabreak, trang trí...)
   - Xem giá real-time
   - Thanh toán đặt cọc (30-50%)

2. **Payment Integration:**
   - ZaloPay payment gateway
   - Transaction success/failure handling
   - Payment confirmation notifications
   - Refund processing (nếu hủy)

3. **Admin Dashboard:**
   - View all bookings
   - Manage availability (block dates)
   - Process refunds
   - Export bookings to Excel/Google Sheets
   - Revenue tracking

4. **Notifications:**
   - Booking confirmation (Zalo Notification)
   - Payment receipt
   - Reminder 24h trước sự kiện
   - Post-event feedback request

### Non-Functional Requirements

1. **Performance:** App load < 2s, payment process < 5s
2. **Reliability:** 99.5% uptime, backup system
3. **Security:** PCI DSS compliant, encrypted data
4. **Scalability:** Handle 100+ concurrent bookings
5. **Mobile-first:** Optimized cho mobile devices

---

## ARCHITECTURE

### Mini App Structure

```
Zalo Mini App: Sol Cafe Booking
│
├─ HOME SCREEN
│   ├─ Hero: "Đặt lịch không gian sự kiện"
│   ├─ Quick actions: "Đặt ngay", "Xem bảng giá"
│   └─ Featured: Top 3 không gian phổ biến
│
├─ BOOKING FLOW (5 screens)
│   │
│   ├─ SCREEN 1: Event Type Selection
│   │   - Cards: Workshop, Team Building, Sinh Nhật, Lớp Học, Khác
│   │   - Each card: Icon, name, starting price
│   │
│   ├─ SCREEN 2: Date & Time Selection
│   │   - Calendar view (available dates in green)
│   │   - Time slots: Sáng (6-12), Chiều (12-17), Tối (17-22)
│   │   - Duration: 4h, 8h, custom
│   │
│   ├─ SCREEN 3: Guest Count & Services
│   │   - Guest count slider: 10-50 people
│   │   - Add-ons: Máy chiếu, Teabreak, Trang trí, Photographer
│   │   - Real-time price update
│   │
│   ├─ SCREEN 4: Customer Information
│   │   - Name, Phone, Email (pre-filled from Zalo profile)
│   │   - Organization/Company (optional)
│   │   - Special requests (textarea)
│   │
│   └─ SCREEN 5: Payment & Confirmation
│       - Order summary (all details)
│       - Deposit amount (30-50% based on total)
│       - ZaloPay button
│       - Terms & conditions checkbox
│
├─ MY BOOKINGS
│   - List of upcoming bookings
│   - Booking details, status, payment
│   - Actions: Reschedule, Cancel, View Receipt
│
├─ PRICE LIST
│   - Full price table (from docs)
│   - Filter by event type
│   - Download PDF option
│
└─ PROFILE
    - User info
    - Booking history
    - Payment methods
    - Support contact
```

### Data Flow Architecture

```
[User Action in Mini App]
    ↓
[Zalo Mini App Frontend]
    ↓
[Zalo Backend API]
    ↓
[Sol Cafe Backend Server]
    ├─→ Check Availability (Calendar API)
    ├─→ Calculate Price (Pricing Engine)
    ├─→ Create Booking (Database)
    └─→ Process Payment (ZaloPay Gateway)
    ↓
[Payment Gateway]
    ├─→ Success: Update booking status → Send notification
    └─→ Failure: Show error → Retry option
    ↓
[Notification Service]
    ├─→ Zalo NS (Native notification)
    ├─→ SMS (Backup)
    └─→ Email (Optional)
```

---

## RELATED CODE FILES

### Files to Create
1. `resources/mini-app-wireframes/` - UI/UX mockups cho từng screen
2. `resources/mini-app-specifications.md` - Detailed technical specs
3. `resources/booking-flow-diagram.md` - User flow diagram
4. `resources/zalopay-integration-guide.md` - Payment setup guide

### Files to Modify
- Không có files cần modify trong phase này

### Files to Delete
- Không có files cần delete

---

## IMPLEMENTATION STEPS

### Step 1: Requirements Gathering (Day 76-77)

**User Stories:**

```
AS A customer,
I WANT TO book event space through Mini App
SO THAT I can quickly check availability and confirm booking without waiting

AS A customer,
I WANT TO pay deposit via ZaloPay
SO THAT my booking is confirmed instantly

AS A customer,
I WANT TO see real-time pricing
SO THAT I know exactly how much I'll pay

AS a staff member,
I WANT TO receive booking notifications
SO THAT I can prepare the space accordingly

AS a business owner,
I WANT to track all bookings and revenue
SO THAT I can analyze performance
```

**Functional Requirements Checklist:**

- [ ] Event type selection (5+ types)
- [ ] Calendar with available dates
- [ ] Time slot selection
- [ ] Guest count input
- [ ] Add-on services selection
- [ ] Real-time price calculation
- [ ] Customer information form
- [ ] ZaloPay integration
- [ ] Booking confirmation
- [ ] Booking history
- [ ] Payment history
- [ ] Admin dashboard
- [ ] Availability management
- [ ] Refund processing

### Step 2: UI/UX Design (Day 78-82)

**Screen 1: Home Screen**

```
┌─────────────────────────────────────┐
│     SOL CAFE BOOKING        [Menu] │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Đặt lịch không gian sự kiện  │ │
│  │  tại Cầu Giấy, Hà Nội         │ │
│  │                               │ │
│  │  [📍] 181 Trần Quốc Vượng   │ │
│  │  [⏰] 6:00 - 22:30           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  [ĐẶT LỊCH NGAY]             │ │
│  └───────────────────────────────┘ │
│                                     │
│  KHÔNG GIAN PHỔ BIẾN:              │
│  ┌──────────┐ ┌──────────┐        │
│  │ Workshop │ │Team Build│        │
│  │ 500K-1.8M│ │ 1M-3.8M  │        │
│  └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐        │
│  │Sinh Nhật │ │ Lớp Học  │        │
│  │ 350K-1.2M│ │ 700K-2.5M│        │
│  └──────────┘ └──────────┘        │
│                                     │
└─────────────────────────────────────┘
```

**Screen 2: Event Type Selection**

```
┌─────────────────────────────────────┐
│  ← Chọn loại sự kiện         [1/5] │
├─────────────────────────────────────┤
│                                     │
│  Bạn muốn tổ chức sự kiện gì?       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📚 Workshop / Training       │ │
│  │ Lớp học, workshop, training  │ │
│  │ Giá từ: 500.000đ             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👔 Team Building             │ │
│  │ Họp nhóm, team gathering     │ │
│  │ Giá từ: 1.000.000đ           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🎂 Sinh Nhật / Tiệc riêng   │ │
│  │ Sinh nhật, họp lớp, offline  │ │
│  │ Giá từ: 350.000đ             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🎓 Lớp học thường xuyên      │ │
│  │ Lớp ngoại ngữ, lập trình...  │ │
│  │ Giá từ: 700.000đ             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📦 Khác                      │ │
│  │ Sự kiện đặc biệt khác        │ │
│  │ Liên hệ để báo giá           │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

**Screen 3: Date & Time Selection**

```
┌─────────────────────────────────────┐
│  ← Chọn ngày & giờ           [2/5] │
├─────────────────────────────────────┤
│                                     │
│  Tháng 3/2026                       │
│  ┌──┬──┬──┬──┬──┬──┬──┐          │
│  │CN│T2│T3│T4│T5│T6│T7│          │
│  ├──┼──┼──┼──┼──┼──┼──┤          │
│  │  │  │14│15│16│17│18│          │
│  │  │  │✅ │✅ │✅ │⭕ │✅ │         │
│  │19│20│21│22│23│24│25│          │
│  │✅ │⭕ │✅ │✅ │✅ │✅ │⭕ │        │
│  │26│27│28│29│30│31│  │          │
│  │✅ │✅ │✅ │✅ │✅ │❌ │  │          │
│  └──┴──┴──┴──┴──┴──┴──┘          │
│                                     │
│  Chọn khung giờ:                   │
│  ┌───────────────────────────────┐ │
│  │ ☐ Sáng (6:00 - 12:00)        │ │
│  │   Giá gốc: x 1.0              │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ ☐ Chiều (12:00 - 17:00)      │ │
│  │   Giá gốc: x 1.0              │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ ☐ Tối (17:00 - 22:00)        │ │
│  │   Giá gốc: x 1.2              │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ ☐ Cả ngày (6:00 - 22:00)     │ │
│  │   Giá gốc: x 1.0              │ │
│  └───────────────────────────────┘ │
│                                     │
│  Thời lượng:                        │
│  [ 4 giờ ] (dropdown: 2h/4h/8h)    │
│                                     │
│         [TIẾP TỤC] →               │
└─────────────────────────────────────┘

Legend: ✅ Available | ⭕ Few slots | ❌ Full
```

**Screen 5: Payment & Confirmation**

```
┌─────────────────────────────────────┐
│  ← Xác nhận & Thanh toán     [5/5] │
├─────────────────────────────────────┤
│                                     │
│  TÓM TẮT ĐẶT LỊCH:                 │
│  ┌───────────────────────────────┐ │
│  │ Loại sự kiện: Workshop        │ │
│  │ Ngày: 20/03/2026              │ │
│  │ Giờ: 14:00 - 18:00            │ │
│  │ Số người: 25 người            │ │
│  │ Dịch vụ thêm:                 │ │
│  │  ✓ Máy chiếu +200K           │ │
│  │  ✓ Teabreak cơ bản +1.75M    │ │
│  │                               │ │
│  │ THÀNH TIỀN: 2.650.000đ       │ │
│  │ ĐẶT CỌC (30%): 795.000đ      │ │
│  └───────────────────────────────┘ │
│                                     │
│  THÔNG TIN KHÁCH HÀNG:              │
│  Họ tên: Nguyễn Văn A               │
│  SĐT: 0912345678                    │
│  Email: ngvana@email.com            │
│                                     │
│  PHƯƠNG THỨC THANH TOÁN:            │
│  ┌───────────────────────────────┐ │
│  │    [💳] THANH TOÁN ZALOPAY    │ │
│  │       795.000đ                │ │
│  └───────────────────────────────┘ │
│                                     │
│  ☐ Tôi đồng ý với điều khoản       │
│                                     │
│         [XÁC NHẬN ĐẶT LỊCH]        │
│                                     │
│  💡 Thanh toán thành công để       │
│  xác nhận đặt lịch ngay!           │
└─────────────────────────────────────┘
```

### Step 3: Development Planning (Day 83-84)

**Tech Stack Recommendation:**

```
FRONTEND:
- Zalo Mini App Framework (ZMP)
- React Native hoặc Vue.js
- Zalo UI Components

BACKEND:
- Node.js + Express
- PostgreSQL/MySQL database
- ZaloPay SDK

INFRASTRUCTURE:
- Cloud hosting (Vercel/Heroku/AWS)
- CDN for static assets
- Redis for caching

INTEGRATIONS:
- ZaloPay Payment Gateway
- Zalo NS (Notification Service)
- Google Calendar (availability sync)
```

**Database Schema:**

```sql
-- Bookings table
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  booking_id VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(15) NOT NULL,
  customer_email VARCHAR(100),
  event_type VARCHAR(50) NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  guest_count INTEGER NOT NULL,
  services JSONB, -- {projector: true, teabreak: "basic", decoration: false}
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20),
  transaction_id VARCHAR(50),
  booking_status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Availability table
CREATE TABLE availability (
  id SERIAL PRIMARY KEY,
  event_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  is_available BOOLEAN DEFAULT true,
  booked_count INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 3
);
```

### Step 4: ZaloPay Integration (Day 85-87)

**ZaloPay Integration Steps:**

1. **Register ZaloPay Business Account**
   - Apply at: https://business.zalopay.vn
   - Submit business documents
   - Get API credentials (app_id, key1, key2)

2. **Backend Integration**

```javascript
// Example: Create ZaloPay order
const createZaloPayOrder = async (booking) => {
  const params = {
    app_id: process.env.ZALOPAY_APP_ID,
    app_trans_id: `${Date.now()}_${booking.id}`,
    app_time: Date.now(),
    amount: booking.deposit_amount,
    description: `Dat coc ${booking.booking_id}`,
    embed_data: JSON.stringify({
      booking_id: booking.booking_id,
      redirect_url: 'https://solcafe-minapp.app/booking/success'
    }),
    item: JSON.stringify([]),
    bank_code: '',
    callback_url: 'https://api.solcafe.vn/zalopay/callback'
  };

  // Generate signature
  const data = params.app_id + '|' + params.app_trans_id + '|' +
               params.app_time + '|' + params.amount + '|' +
               params.embed_data + '|' + params.item;
  params.mac = hmacSha256(process.env.ZALOPAY_KEY1, data);

  // Call ZaloPay API
  const response = await axios.post(
    'https://openapi.zalopay.vn/v2/create',
    null,
    { params }
  );

  return response.data; // {order_url, zp_trans_token, ...}
};
```

3. **Frontend Integration**

```javascript
// Redirect to ZaloPay payment page
const handlePayment = async () => {
  const orderUrl = await createZaloPayOrder(bookingData);
  // ZaloPay will open in app or web browser
  window.location.href = orderUrl;
};
```

4. **Callback Handling**

```javascript
// Handle ZaloPay callback
app.post('/zalopay/callback', async (req, res) => {
  const { data, mac } = req.body;

  // Verify signature
  const calculatedMac = hmacSha256(process.env.ZALOPAY_KEY2, data);

  if (mac === calculatedMac) {
    const result = JSON.parse(data);

    // Update booking status
    await updateBookingPayment(
      result.app_trans_id.split('_')[1],
      'paid',
      result.zp_trans_id
    );

    // Send confirmation notification
    await sendBookingConfirmation(result.embed_data.booking_id);

    res.json({ return_code: 1, return_message: 'Success' });
  } else {
    res.json({ return_code: -1, return_message: 'Invalid signature' });
  }
});
```

### Step 5: Testing (Day 88-90)

**Testing Checklist:**

**Unit Tests:**
- [ ] Price calculation engine
- [ ] Availability check logic
- [ ] ZaloPay signature generation
- [ ] Booking status updates

**Integration Tests:**
- [ ] End-to-end booking flow
- [ ] Payment success scenario
- [ ] Payment failure scenario
- [ ] Notification sending
- [ ] Refund processing

**UAT (User Acceptance Testing):**
- [ ] Test with 5 real users
- [ ] Collect feedback on UX
- [ ] Measure completion time (target: < 3 min)
- [ ] Test edge cases (invalid input, network errors)

**Load Testing:**
- [ ] Simulate 50 concurrent bookings
- [ ] Test payment gateway uptime
- [ ] Verify database performance

### Step 6: Launch (Day 91-92)

**Soft Launch Strategy:**

- **Day 91:** Internal testing (staff only)
- **Day 92:** Beta launch (20 loyal customers)
- **Day 93-94:** Monitor and fix bugs
- **Day 95:** Public launch (100% traffic)

**Launch Day Checklist:**

- [ ] All tests passed
- [ ] ZaloPay production credentials
- [ ] SSL certificate configured
- [ ] Error tracking set up (Sentry)
- [ ] Analytics installed (Google Analytics + Zalo Analytics)
- [ ] Backup system ready
- [ ] Staff trained on new system
- [ ] FAQ document ready
- [ ] Customer support prepared

---

## TODO LIST

### Week 11-12 (23/05 - 05/06)

**Week 11: Planning & Design (Day 76-82)**

- [ ] **Day 76-77:** Requirements gathering
  - [ ] Document user stories
  - [ ] Define functional requirements
  - [ ] Create acceptance criteria

- [ ] **Day 78-82:** UI/UX design
  - [ ] Create wireframes for 5 screens
  - [ ] Design high-fidelity mockups
  - [ ] Design system (colors, typography, components)
  - [ ] Interactive prototype (Figma)

**Week 11: Development Setup (Day 83-87)**

- [ ] **Day 83-84:** Development planning
  - [ ] Choose tech stack
  - [ ] Set up project structure
  - [ ] Design database schema
  - [ ] Define API endpoints

- [ ] **Day 85-87:** ZaloPay integration
  - [ ] Register ZaloPay business account
  - [ ] Implement payment backend
  - [ ] Integrate payment frontend
  - [ ] Test payment flow (sandbox)

**Week 12: Testing & Launch (Day 88-95)**

- [ ] **Day 88-90:** Testing
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] UAT with real users
  - [ ] Load testing
  - [ ] Bug fixes

- [ ] **Day 91-92:** Launch
  - [ ] Soft launch (internal)
  - [ ] Beta launch (20 users)
  - [ ] Monitor and fix issues
  - [ ] Public launch

- [ ] **Day 93-95:** Post-launch
  - [ ] Monitor performance
  - [ ] Collect user feedback
  - [ ] Make quick improvements
  - [ ] Plan Phase 2 features

---

## SUCCESS CRITERIA

### Definition of Done
1. ✅ Mini App deployed và accessible từ Zalo OA
2. ✅ Booking flow completes < 3 phút
3. ✅ ZaloPay integration working (success rate > 95%)
4. ✅ Booking confirmation sent via Zalo NS
5. ✅ Admin dashboard for staff to manage bookings
6. ✅ 50+ successful bookings trong first 2 weeks

### KPIs for Phase 5

| Metric | Week 1 | Week 2 | Week 3 | Week 4 | Target |
|--------|--------|--------|--------|--------|--------|
| **App installs** | 50 | 100 | 150 | 200 | 500/month |
| **Booking attempts** | 30 | 60 | 90 | 120 | 300/month |
| **Completed bookings** | 20 | 45 | 70 | 95 | 230/month |
| **Payment success rate** | 90% | 93% | 95% | 97% | 95%+ |
| **Avg. booking time** | 4.5min | 3.8min | 3.2min | 2.8min | < 3min |
| **No-show rate** | 15% | 12% | 10% | 8% | < 10% |
| **Revenue from app** | 8M | 15M | 22M | 30M | 75M/month |

---

## RISK ASSESSMENT

### Potential Issues

**Risk 1: ZaloPay application rejected**
- **Nguyên nhân:** Business documents incomplete, doesn't meet criteria
- **Mitigation:** Prepare all documents carefully, apply early
- **Contingency:** Use alternative payment (Bank transfer, MoMo)

**Risk 2: Payment integration bugs**
- **Nguyên nhân:** Incorrect signature handling, API changes
- **Mitigation:** Thorough testing, use official SDK
- **Contingency:** Manual payment confirmation as fallback

**Risk 3: Low adoption rate**
- **Nguyên nhân:** Users prefer chatbot, app too complex
- **Mitigation:** Clear CTAs in chatbot, offer incentives
- **Contingency:** Keep chatbot booking available

**Risk 4: High development cost overrun**
- **Nguyên nhân:** Scope creep, technical challenges
- **Mitigation:** Strict scope control, MVP approach
- **Contingency:** Phase 2 features deprioritized

**Risk 5: Poor UX leading to abandoned bookings**
- **Nguyên nhân:** Too many steps, confusing flow
- **Mitigation:** UAT with real users, simplify flow
- **Contingency:** Rapid iterations based on feedback

---

## NEXT STEPS

### Dependencies
- Phase 5 cần Phase 2 (Chatbot) để drive traffic
- Need ZaloPay approval before development start

### Follow-up Tasks
1. **After Phase 5:** Bắt đầu Phase 6 - Measurement & Optimization
2. **Month 2:** Add Phase 2 features (recurring bookings, waitlist)
3. **Month 3:** Integrate with CRM system
4. **Ongoing:** Monthly UX improvements, A/B testing

---

## COST BREAKDOWN

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| **Development** | 15.000.000đ | 3 tuần x 5M (full-stack developer) |
| **UI/UX Design** | 3.000.000đ | Designer (freelance or agency) |
| **ZaloPay setup** | 1.000.000đ | Application fee, documentation |
| **Hosting & infrastructure** | 1.000.000đ/tháng | Cloud hosting, database |
| **Testing (UAT)** | 500.000đ | Incentives cho test users |
| **Contingency** | 2.500.000đ | 10% buffer |
| **Total One-time** | **22.500.000đ** | Setup cost |
| **Ongoing** | **1.000.000đ/tháng** | Hosting + maintenance |

**ROI Target:** Break-even trong 3 tháng (75M revenue vs 25.5M cost)

---

## TEMPLATES & RESOURCES

### Mini App Wireframes

See: `./resources/mini-app-wireframes-all-screens.md`

### Technical Specifications

See: `./resources/mini-app-tech-specs.md`

### ZaloPay Integration Guide

See: `./resources/zalopay-integration-step-by-step.md`

---

## QUESTIONS & CLARIFICATIONS

### Unresolved Questions

1. **Development approach:** In-house team or outsource to agency?
2. **MVP scope:** Confirm Phase 1 features only or include Phase 2?
3. **Database choice:** Have existing database or build new?
4. **Staff training:** Who will manage admin dashboard? Need training?
5. **Alternative payment:** Want to add MoMo/VNPAY as backup?

---

**Người lập:** AI Planner Agent
**Ngày tạo:** 14/03/2026
**Deadline:** 05/06/2026 (42 days)
**Status:** Pending approval

---
