# PHASE 1: THIẾT LẬP ZALO OFFICIAL ACCOUNT
## Sol Cafe Coworking - 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội

---

## CONTEXT LINKS
- [Plan tổng quan](./plan.md)
- [Bảng giá dịch vụ](../../docs/bang-gia-dich-vu-thue-mat-binh-su-kien-sol-cafe-coworking.md)
- [Chương trình khách hàng thân thiết](../../docs/chuong-trinh-khach-hang-than-thiet-cho-dich-vu-thue-su-kien-tai-sol-cafe-coworking-181-tran-quoc-vuong-cau-giay-ha-noi.md)

---

## OVERVIEW

**Priority:** 🔴 CRITICAL (Must complete first)

**Current Status:** Pending

**Description:** Thiết lập Zalo Official Account chuyên nghiệp với đầy đủ thông tin, hình ảnh, và cấu hình để bắt đầu thu hút followers và tương tác với khách hàng.

---

## KEY INSIGHTS

### Tại sao chọn Zalo OA?
1. **Độ phủ cao:** 75+ triệu người dùng VN dùng Zalo hàng tháng
2. **Target chính xác:** Định vị theo vị trí địa lý (Cầu Giấy), sở thích, hành vi
3. **Tỷ lệ chuyển đổi cao:** Chat trực tiếp → Booking nhanh hơn Facebook
4. **Chi phí hợp lý:** CPM thấp hơn Facebook, Instagram

### Loại Zalo OA phù hợp

| Loại | Mô tả | Phí верифікации | Khuyên dùng |
|------|-------|-----------------|-------------|
| **Generic OA** | Tài khoản chung, không gắn бренđ | Miễn phí | ❌ Không chuyên nghiệp |
| **Public OA** | Tài khoản công khai, có verify | 2.150.000đ | ✅ KHUYẾN NGHỊ |

**Lựa chọn:** Public OA (xứng đáng đầu tư verify để tăng uy tín)

---

## REQUIREMENTS

### Functional Requirements
1. Đăng ký và верифіка Zalo OA Public
2. Thiết lập profile hoàn chỉnh (tên, bio, category)
3. Upload avatar và cover chất lượng cao
4. Cấu hình thông tin liên hệ (hotline, email, địa chỉ)
5. Tích hợp fanpage Facebook và website
6. Thiết lập auto-reply tin nhắn chào mừng

### Non-Functional Requirements
1. Thời gian load avatar/cover < 2s
2. Thông tin chính xác 100%
3. UI/UX chuyên nghiệp, đồng nhất với brand
4. Responsive trên mobile và desktop

---

## ARCHITECTURE

### Component Structure

```
Zalo OA Sol Cafe Coworking
├── Profile Information
│   ├── Tên: Sol Cafe Coworking
│   ├── Username: @solcafecoworking
│   ├── Category: Sự kiện & Địa điểm tổ chức
│   ├── Bio: "Cho thuê mặt bằng sự kiện tại Cầu Giấy - 181 Trần Quốc Vượng"
│   └── Tags: #coworking #eventvenue #caugiaay
│
├── Visual Assets
│   ├── Avatar (200x200px): Logo Sol Cafe
│   ├── Cover (1080x600px): Không gian event đẹp
│   └── Gallery (10-15 ảnh): Các không gian, setup sự kiện
│
├── Contact Information
│   ├── Hotline/Zalo: [Số điện thoại]
│   ├── Email: booking@solcafecoworking.vn
│   ├── Website: www.solcafecoworking.vn
│   ├── Địa chỉ: 181 Trần Quốc Vượng, Cầu Giấy, HN
│   └── Giờ làm việc: 6:00-22:30
│
└── Integration
    ├── Fanpage Facebook: fb.com/solcafecoworking
    ├── Instagram: @solcafecoworking
    └── Website booking form
```

---

## RELATED CODE FILES

### Files to Create
1. `resources/zalo-oa-assets/` - Chứa avatar, cover, gallery images
2. `resources/zalo-oa-copywriting.md` - Caption, bio, template tin nhắn
3. `resources/zalo-oa-checklist.md` - Checklist thiết lập

### Files to Modify
- Không có files cần modify

### Files to Delete
- Không có files cần delete

---

## IMPLEMENTATION STEPS

### Step 1: Chuẩn bị tài liệu (Day 1-2)

**Avatar (200x200px)**
- Nội dung: Logo Sol Cafe Coworking
- Màu sắc: Xanh lá (#2E7D32) + Trắng
- Format: PNG, nền trong suốt
- Text: "Sol Cafe" (chính) + "Coworking" (phụ, nhỏ hơn)

**Cover Photo (1080x600px)**
- Nội dung: Ảnh không gian event đẹp (20-30 người)
- Text overlay: "Cho thuê mặt bằng sự kiện tại Cầu Giấy"
- Subtext: "Workshop • Team Building • Sinh Nhật • Lớp Học"
- CTA: "Đặt lịch ngay: 181 Trần Quốc Vượng"
- Màu sắc: Đồng nhất với brand

**Gallery Images (10-15 ảnh)**
- 3-5 ảnh: Không gian mở (ground floor)
- 2-3 ảnh: Private room
- 2-3 ảnh: Rooftop (nếu có)
- 3-4 ảnh: Ảnh thực tế sự kiện (workshop, sinh nhật...)
- Resolution: Tối thiểu 1080x1080px

### Step 2: Đăng ký Zalo OA (Day 3)

**Quy trình đăng ký:**
1. Truy cập: oa.zalo.me
2. Chọn "Đăng ký OA"
3. Chọn loại: **Public OA**
4. Điền thông tin:
   - Tên OA: Sol Cafe Coworking
   - Username: @solcafecoworking
   - Danh mục: Sự kiện & Địa điểm tổ chức
5. Upload avatar + cover
6. Điền mô tả (bio):
   ```
   Cho thuê mặt bằng sự kiện tại Cầu Giấy, Hà Nội
   📍 181 Trần Quốc Vượng
   ☕ Workshop • Team Building • Sinh Nhật • Lớp Học
   💰 Giá từ 350K - 3.8M tùy quy mô
   📞 Hotline/Zalo: [SĐT]
   ```

### Step 3: Verification (Day 4-7)

**Tài liệu cần chuẩn bị:**
1. **Giấy phép kinh doanh** (bản scan màu)
2. **CMND/CCCD** người đại diện (2 mặt)
3. **Giấy đăng ký kinh doanh** (nếu có)
4. **Hóa đơn điện** (để chứng minh địa chỉ hoạt động)

**Quy trình verify:**
1. Nộp hồ sơ qua Zalo OA
2. Thanh toán phí: **2.150.000đ** (chuyển khoản)
3. Chờ xét duyệt: 3-7 ngày làm việc
4. Nhận thông báo verify thành công

### Step 4: Cấu hình thông tin (Day 8)

**Thông tin liên hệ:**
- Hotline: [Số điện thoại chính]
- Email: booking@solcafecoworking.vn
- Website: www.solcafecoworking.vn
- Fanpage: fb.com/solcafecoworking

**Giờ làm việc:**
- Thứ 2 - Thứ 6: 6:00 - 22:30
- Thứ 7 - Chủ nhật: 7:00 - 23:00

**Danh mục dịch vụ:**
- Workshop/Training
- Team Building
- Sinh Nhật/Tiệc riêng
- Họp nhóm doanh nghiệp

### Step 5: Thiết lập auto-reply (Day 9-10)

**Tin nhắn chào mừng (Greeting message):**
```
Chào mừng bạn đến với Sol Cafe Coworking! 🎉☕

Cảm ơn đã quan tâm đến dịch vụ cho thuê mặt bằng sự kiện của chúng mình tại:
📍 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội

Bạn đang tìm kiếm không gian cho sự kiện gì? Nhấn số để chọn:

1️⃣ Workshop/Training/Lớp học
2️⃣ Team Building/Họp nhóm công ty
3️⃣ Sinh nhật/Tiệc riêng
4️⃣ Xem bảng giá đầy đủ
5️⃣ Được tư vấn trực tiếp

Hoặc gửi "MENU" để xem các lựa chọn khác! 👇
```

**Tin nhắn "Thank you" khi follow:**
```
Cảm ơn bạn đã theo dõi Sol Cafe Coworking! ✨

Để nhận ưu đãi đặc biệt, hãy nhắn:
🎁 "UU_DAI" - Xem khuyến mãi đang chạy
📅 "DAT_LICH" - Đặt lịch sự kiện
💰 "BANG_GIA" - Xem bảng giá chi tiết

Nhân viên sẽ phản hồi trong vòng 5 phút! ⏰
```

### Step 6: Test và launch (Day 10)

**Checklist trước khi launch:**
- [ ] Avatar hiển thị đúng, không bị cắt
- [ ] Cover rõ nét, text đọc được
- [ ] Thông tin liên hệ chính xác 100%
- [ ] Auto-reply hoạt động
- [ ] Test gửi tin nhắn → Nhận reply
- [ ] Test trên mobile app và web
- [ ] Share link Zalo OA cho 5 người test

**Launch:**
- Share link OA trên Fanpage Facebook
- Gửi link cho khách hàng cũ qua Zalo
- Đặt QR code tại quầy lễ tân
- Tambahkan link OA vào website

---

## TODO LIST

### Week 1 (14/03 - 20/03)

- [ ] **Day 1-2:** Design avatar và cover photo
  - [ ] Hire designer hoặc use Canva Pro
  - [ ] Create 3 variations cho avatar
  - [ ] Create 3 variations cho cover
  - [ ] Chọn version best và export

- [ ] **Day 3:** Chụp ảnh không gian (nếu chưa có)
  - [ ] Chụp 15-20 ảnh không gian
  - [ ] Edit ảnh (light, color correction)
  - [ ] Chọn 10-15 ảnh best cho gallery

- [ ] **Day 4:** Đăng ký Zalo OA
  - [ ] Create account tại oa.zalo.me
  - [ ] Fill thông tin cơ bản
  - [ ] Upload avatar + cover
  - [ ] Write bio description

- [ ] **Day 5-7:** Chuẩn bị hồ sơ verification
  - [ ] Scan giấy phép kinh doanh
  - [ ] Scan CMND/CCCD
  - [ ] Chuẩn bị hóa đơn điện
  - [ ] Submit hồ sơ verify
  - [ ] Thanh toán phí 2.150.000đ

- [ ] **Day 8:** Cấu hình thông tin liên hệ
  - [ ] Thêm hotline, email, website
  - [ ] Thêm địa chỉ + Google Maps embed
  - [ ] Set giờ làm việc
  - [ ] Link Fanpage Facebook

- [ ] **Day 9-10:** Setup auto-reply
  - [ ] Write greeting message
  - [ ] Write "Thank you" message
  - [ ] Test auto-reply functionality
  - [ ] Adjust tone of voice

- [ ] **Day 10:** Final test và launch
  - [ ] Complete checklist trên
  - [ ] Share link OA internally
  - [ ] Launch publicly
  - [ ] Monitor first 50 followers

---

## SUCCESS CRITERIA

### Definition of Done
1. ✅ Zalo OA Public verified với dấu check xanh
2. ✅ Avatar và cover hiển thị professional, không bị lỗi
3. ✅ Thông tin liên hệ chính xác và đầy đủ
4. ✅ Auto-reply hoạt động 100%
5. ✅ Gallery có tối thiểu 10 ảnh chất lượng cao
6. ✅ Test với 5 người user thực tế → Feedback positive

### KPIs for Phase 1
- **Setup completion:** 100%
- **Verification status:** Verified ✅
- **Profile completeness:** 100%
- **First 50 followers:** Dalam 7 ngày sau launch
- **Response rate:** 95%+ (auto + manual)

---

## RISK ASSESSMENT

### Potential Issues

**Risk 1: Verification bị từ chối**
- **Nguyên nhân:** Thiếu tài liệu, thông tin không khớp
- **Mitigation:** Chuẩn bị đầy đủ giấy tờ, cross-check với BR
- **Contingency:** Liên hệ support Zalo để clarify

**Risk 2: Avatar/cover bị reject**
- **Nguyên nhân:** Kích thước sai, vi phạm content policy
- **Mitigation:** Follow đúng size guide, tránh text quá nhiều
- **Contingency:** Re-design với content đơn giản hơn

**Risk 3: Auto-reply không hoạt động**
- **Nguyên nhân:** Bug system, setup sai
- **Mitigation:** Test kỹ trước launch, có manual fallback
- **Contingency:** Nhân viên trực chat 24/7 trong tuần đầu

---

## SECURITY CONSIDERATIONS

### Authentication & Authorization
- Chỉ admin và manager có quyền edit Zalo OA
- Không chia sẻ password verify với người ngoài
- Enable 2FA cho account Zalo Business

### Data Protection
- Không lưu thông tin khách hàng trên personal device
- Tuân thủ quy định bảo mật dữ liệu VN
- Request consent trước khi collect data qua chatbot

---

## NEXT STEPS

### Dependencies
- Phase 1 cần hoàn thành trước Phase 2 (Chatbot)
- Avatar/cover cần sẵn sàng trước Day 3
- Verification có thể take 3-7 days → Plan accordingly

### Follow-up Tasks
1. **After verification:** Bắt đầu Phase 2 - Chatbot development
2. **After launch:** Monitor follower growth daily
3. **Week 2:** Train nhân viên về Zalo OA management
4. **Week 3:** Start content planning (Phase 3)

---

## COST BREAKDOWN

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| **Verification fee** | 2.150.000đ | One-time fee cho Public OA |
| **Design assets** | 500.000đ | Avatar + cover design (Canva Pro hoặc hire) |
| **Photography** | 1.000.000đ | Chụp ảnh không gian (nếu cần hire photographer) |
| **Total** | **3.650.000đ** | One-time cost |

---

## TEMPLATES & RESOURCES

### Template Tin nhắn Chào mừng

Xem section "Step 5: Thiết lập auto-reply" ở trên.

### Checklist File

See: `./resources/zalo-oa-setup-checklist.md`

### Copywriting Guide

See: `./resources/zalo-oa-copywriting-guide.md`

---

## QUESTIONS & CLARIFICATIONS

### Unresolved Questions

1. **Số điện thoại chính:** Which số để use cho hotline? (Cần confirm với owner)
2. **Email address:** Có sẵn domain email hay cần create mới?
3. **BR verification:** Đã có giấy phép kinh doanh chưa? (Cần check)
4. **Design assets:** Có sẵn logo/vector không hay cần design từ scratch?
5. **Photography:** Đã có ảnh không gian chưa hay cần chụp mới?

---

**Người lập:** AI Planner Agent
**Ngày tạo:** 14/03/2026
**Deadline:** 20/03/2026 (7 days)
**Status:** Pending approval

---
