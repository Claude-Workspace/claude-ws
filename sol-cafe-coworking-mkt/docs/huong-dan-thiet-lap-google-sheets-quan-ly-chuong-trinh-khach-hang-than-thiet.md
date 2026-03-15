# HƯỚNG DẪN THIẾT LẬP GOOGLE SHEETS QUẢN LÝ CHƯƠNG TRÌNH KHÁCH HÀNG THÂN THIẾT

## Sol Cafe Coworking

---

## MỤC LỤC

1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc các sheet](#2-cấu-trúc-các-sheet)
3. [Hướng dẫn tạo từng sheet](#3-hướng-dẫn-tạo-từng-sheet)
4. [Formula tự động](#4-formula-tự-động)
5. [Google Forms integration](#5-google-forms-integration)
6. [Zalo notification setup](#6-zalo-notification-setup)
7. [Bảo mật và backup](#7-bảo-mật-và-backup)

---

## 1. TỔNG QUAN

### 1.1 Mục tiêu

- Quản lý thông tin khách hàng thành viên
- Theo dõi điểm tích lũy và hạng thành viên
- Tự động tính toán ưu đãi
- Tạo báo cáo hiệu quả chương trình

### 1.2 Công cụ cần thiết

- **Google Sheets** (miễn phí)
- **Google Forms** (miễn phí)
- **Google Apps Script** (miễn phí)
- **Zalo OA** (optional, giai đoạn 2)

---

## 2. CẤU TRÚC CÁC SHEET

Tạo file Google Sheets với 7 tabs sau:

| Tab name | Mục đích | Ai có thể xem | Ai có thể edit |
|----------|---------|--------------|---------------|
| **DANH_SACH_KH** | Thông tin khách hàng | All | Admin |
| **LICH_SU_DAT** | Lịch sử đặt chỗ | All | Admin |
| **TIEM_DIEM** | Điểm tích lũy | All | Admin |
| **QUY_DOI** | Lịch sử quy đổi điểm | All | Admin |
| **HANG_THANH_VIEN** | Quy tắc hạng thành viên | All | Admin |
| **THONG_KE** | Báo cáo thống kê | All | Admin |
| **SETTING** | Cấu hình hệ thống | Admin only | Admin only |

---

## 3. HƯỚNG DẪN TẠO TỪNG SHEET

### 3.1 Sheet: DANH_SACH_KH (Danh sách khách hàng)

**Columns structure:**

| Column | Header | Data Type | Description | Formula/Validation |
|--------|--------|-----------|-------------|-------------------|
| A | MA_KH | Text | Mã khách hàng | Auto: "SOL" & YYYY & RIGHT(SĐT,3) |
| B | HO_TEN | Text | Họ và tên | Required |
| C | SDT | Text | Số điện thoại | Required, Unique |
| D | EMAIL | Text | Email | Optional |
| E | NGAY_SINH | Date | Ngày sinh | Optional |
| F | LOAI_KH | Dropdown | Loại khách hàng | Options: Cá nhân/Doanh nghiệp/Sinh viên |
| G | NGAY_DANG_KY | Date | Ngày đăng ký | Auto: TODAY() |
| H | HANG_HIEN_TAI | Text | Hạng hiện tại | Auto: VLOOKUP from SO_LAN_DAT |
| I | SO_LAN_DAT | Number | Số lần đặt | Auto: COUNTIF from LICH_SU_DAT |
| J | DIEM_HIEN_CO | Number | Điểm hiện có | Auto: SUM from TIEM_DIEM |
| K | TRANG_THAI | Dropdown | Trạng thái | Options: Active/Inactive |
| L | GHICHU | Text | Ghi chú | Optional |

**Sample data:**

```
MA_KH     | HO_TEN        | SDT        | EMAIL              | NGAY_SINH   | LOAI_KH    | NGAY_DANG_KY | HANG_HIEN_TAI | SO_LAN_DAT | DIEM_HIEN_CO | TRANG_THAI | GHICHU
SOL2026789| Nguyen Van A  | 0901234567 | email@example.com | 1990-05-15   | Cá nhân    | 2026-03-14   | Bạc           | 3          | 198          | Active      | VIP
```

**Formula cho Column H (Hạng hiện tại):**

```excel
=IF(I2<4, "Bạc", IF(I2<9, "Vàng", "Kim cương"))
```

**Formula cho Column J (Điểm hiện có):**

```excel
=SUMIF(TIEM_DIEM!C:C, A2, TIEM_DIEM!F:F) - SUMIF(QUY_DOI!C:C, A2, QUY_DOI!F:F)
```

---

### 3.2 Sheet: LICH_SU_DAT (Lịch sử đặt chỗ)

**Columns structure:**

| Column | Header | Data Type | Description | Formula/Validation |
|--------|--------|-----------|-------------|-------------------|
| A | MA_DAT | Text | Mã đặt chỗ | Auto: "DAT" & YYYYMMDD & "001" |
| B | MA_KH | Text | Mã khách hàng | VLOOKUP from DANH_SACH_KH |
| C | NGAY_DAT | Date | Ngày đặt | Auto: TODAY() |
| D | NGAY_SU_KIEN | Date | Ngày sự kiện | Required |
| E | LOAI_SK | Dropdown | Loại sự kiện | Options: Sinh viên/Doanh nghiệp/Cá nhân |
| F | SO_NGUOI | Number | Số người | Required |
| G | THOI_LUONG | Number | Thời lượng (giờ) | Required |
| H | GIA_TRUOC_GIAM | Currency | Giá trước giảm | Auto: Based on pricing |
| I | GIAM_GIA | Percentage | Giảm giá (%) | Auto: Based on rank/milestone |
| J | GIA_SAU_GIAM | Currency | Giá sau giảm | = H2 * (1 - I2) |
| K | DA_THANH_TOAN | Checkbox | Đã thanh toán | Checkbox |
| L | DA_TICH_DIEM | Checkbox | Đã tích điểm | Checkbox |
| M | GHICHU | Text | Ghi chú | Optional |

**Formula cho Column J (Giá sau giảm):**

```excel
=H2 * (1 - I2)
```

**Conditional Formatting:**
- Row màu vàng: Chưa thanh toán (K=FALSE)
- Row màu xanh: Đã thanh toán, chưa tích điểm (K=TRUE, L=FALSE)
- Row màu xám: Đã hoàn tất (K=TRUE, L=TRUE)

---

### 3.3 Sheet: TIEM_DIEM (Tích điểm)

**Columns structure:**

| Column | Header | Data Type | Description | Formula/Validation |
|--------|--------|-----------|-------------|-------------------|
| A | MA_GD | Text | Mã giao dịch | Auto: "DIEM" & YYYYMMDD & "001" |
| B | NGAY_TICH | Date | Ngày tích | Auto: TODAY() |
| C | MA_KH | Text | Mã khách hàng | VLOOKUP from DANH_SACH_KH |
| D | MA_DAT | Text | Mã đặt chỗ liên quan | VLOOKUP from LICH_SU_DAT |
| E | GIA_TRI_THANH_TOAN | Currency | Giá trị thanh toán | VLOOKUP from LICH_SU_DAT |
| F | DIEM_TICH | Number | Điểm tích | = E2 / 10000 |
| G | HANG_AP_DUNG | Text | Hạng áp dụng | VLOOKUP from DANH_SACH_KH |
| H | HE_SO_NHAN | Number | Hệ số nhân | Auto: Based on rank |
| I | DIEM_THUONG | Number | Điểm thưởng | Optional |
| J | TONG_DIEM | Number | Tổng điểm | = (F2 * H2) + I2 |
| K | HET_HAN | Date | Hết hạn | = B2 + 365 |
| L | TRANG_THAI | Dropdown | Trạng thái | Options: Active/Expired/Redeemed |

**Formula cho Column H (Hệ số nhân):**

```excel
=IF(G2="Bạc", 1, IF(G2="Vàng", 1.2, IF(G2="Kim cương", 1.5, 1)))
```

**Formula cho Column J (Tổng điểm):**

```excel
=(F2 * H2) + I2
```

**Formula cho Column K (Hết hạn):**

```excel
=DATE(YEAR(B2)+1, MONTH(B2), DAY(B2))
```

---

### 3.4 Sheet: QUY_DOI (Quy đổi điểm)

**Columns structure:**

| Column | Header | Data Type | Description | Formula/Validation |
|--------|--------|-----------|-------------|-------------------|
| A | MA_QD | Text | Mã quy đổi | Auto: "QD" & YYYYMMDD & "001" |
| B | NGAY_QD | Date | Ngày quy đổi | Auto: TODAY() |
| C | MA_KH | Text | Mã khách hàng | VLOOKUP from DANH_SACH_KH |
| D | DIEM_QD | Number | Điểm quy đổi | Required |
| E | GIA_TRI_UU_DAI | Currency | Giá trị ưu đãi | Auto: Based on DIEM_QD |
| F | DIEM_CON_LAI | Number | Điểm còn lại | = VLOOKUP previous - D |
| G | MA_DAT_SU_DUNG | Text | Mã đặt chỗ sử dụng | VLOOKUP from LICH_SU_DAT |
| H | TRANG_THAI | Dropdown | Trạng thái | Options: Applied/Cancelled |
| I | GHICHU | Text | Ghi chú | Optional |

**Formula cho Column E (Giá trị ưu đãi):**

```excel
=IF(D2<200, 0, IF(D2<500, 10000, IF(D2<1000, 30000, IF(D2<2000, 50000, IF(D2<5000, 100000, IF(D2<10000, 300000, 700000))))))
```

**Bảng quy đổi điểm (Reference)**:

| Điểm quy đổi | Giá trị ưu đãi |
|-------------|---------------|
| 200 - 499 | 10.000 VND |
| 500 - 999 | 30.000 VND |
| 1000 - 1999 | 50.000 VND |
| 2000 - 4999 | 100.000 VND |
| 5000 - 9999 | 300.000 VND |
| 10000+ | 700.000 VND |

---

### 3.5 Sheet: HANG_THANH_VIEN (Quy tắc hạng thành viên)

**Reference table** (không cần formula):

| Hạng | Số lần đặt tối thiểu | Giảm giá (%) | Tốc độ tích điểm | Free thiết bị | Tea break | Đặc quyền khác |
|------|-------------------|--------------|-----------------|--------------|-----------|---------------|
| Bạc | 1 | 5 | 1x | Không | Không | Đổi lịch 1 lần |
| Vàng | 4 | 10 | 1.2x | Cơ bản | Cơ bản | Đổi lịch 2 lần |
| Kim cương | 9 | 15 | 1.5x | Cao cấp | Nâng cao | Đổi lịch unlimited + Account Manager |

---

### 3.6 Sheet: THONG_KE (Thống kê)

**Dashboard metrics:**

| Metric | Formula | Description |
|--------|---------|-------------|
| Tổng số thành viên | =COUNTA(DANH_SACH_KH!A:A)-1 | Đếm số khách hàng |
| Số thành viên Active | =COUNTIF(DANH_SACH_KH!K:K,"Active") | Đếm thành viên hoạt động |
| Tổng điểm đã phát | =SUM(TIEM_DIEM!J:J) | Tổng điểm tích lũy |
| Tổng điểm đã quy đổi | =SUM(QUY_DOI!D:D) | Tổng điểm đã dùng |
| Tổng điểm còn lại | =J2 - K2 | Điểm khả dụng |
| Tổng số lần đặt | =COUNTA(LICH_SU_DAT!A:A)-1 | Số giao dịch |
| Doanh thu từ thành viên | =SUMIF(LICH_SU_DAT!K:K,TRUE, LICH_SU_DAT!J:J) | Doanh thu |
| Tổng ưu đãi đã cấp | =SUM(LICH_SU_DAT!I:I) | Giá trị ưu đãi |

**Phân theo hạng:**

| Hạng | Số lượng | % tổng | Tổng điểm | Điểm trung bình |
|------|---------|--------|-----------|-----------------|
| Bạc | =COUNTIF(DANH_SACH_KH!H:H,"Bạc") | =B2/COUNTA(DANH_SACH_KH!H:H) | =SUMIF(DANH_SACH_KH!H:H,"Bạc",DANH_SACH_KH!J:J) | =C2/B2 |
| Vàng | =COUNTIF(DANH_SACH_KH!H:H,"Vàng") | =B3/COUNTA(DANH_SACH_KH!H:H) | =SUMIF(DANH_SACH_KH!H:H,"Vàng",DANH_SACH_KH!J:J) | =C3/B3 |
| Kim cương | =COUNTIF(DANH_SACH_KH!H:H,"Kim cương") | =B4/COUNTA(DANH_SACH_KH!H:H) | =SUMIF(DANH_SACH_KH!H:H,"Kim cương",DANH_SACH_KH!J:J) | =C4/B4 |

---

### 3.7 Sheet: SETTING (Cấu hình hệ thống)

**Configuration parameters:**

| Parameter | Value | Description |
|-----------|-------|-------------|
| TEN_CUA_HANG | Sol Cafe Coworking | Tên cửa hàng |
| DIA_CHI | 181 Tran Quoc Vuong, Cau Giay, HN | Địa chỉ |
| HOTLINE | 0901234567 | Số điện thoại |
| EMAIL | booking@solcafe.vn | Email |
| DIEM_PER_VND | 0.01 | 100.000 VND = 10 điểm |
| DIEM_HET_HAN_THANG | 12 | Điểm hết hạn sau 12 tháng |
| MAX_QD_PERCENT | 50 | Max quy đổi 50% giá trị đơn |
| MIN_QD_DIEM | 200 | Min 200 điểm để quy đổi |

---

## 4. FORMULA TỰ ĐỘNG

### 4.1 Tự động tạo mã khách hàng

```excel
=SOL & YEAR(TODAY()) & RIGHT(C2, 3)
```

### 4.2 Tự động tính hạng thành viên

```excel
=IF(I2<4, "Bạc", IF(I2<9, "Vàng", "Kim cương"))
```

### 4.3 Tự động tính giảm giá theo mốc

```excel
=IF(COUNTIF(LICH_SU_DAT!B:B, B2)=3, 0.1, IF(COUNTIF(LICH_SU_DAT!B:B, B2)=5, 0.2, IF(COUNTIF(LICH_SU_DAT!B:B, B2)=8, 0.25, IF(COUNTIF(LICH_SU_DAT!B:B, B2)=10, 0.3, IF(COUNTIF(LICH_SU_DAT!B:B, B2)=15, 0.35, 0)))))
```

### 4.4 Tự động kiểm tra điểm hết hạn

```excel
=IF(K2<TODAY(), "Expired", "Active")
```

---

## 5. GOOGLE FORMS INTEGRATION

### 5.1 Tạo Form đăng ký thành viên

**Form fields:**

1. **Họ và tên** (Required) - Text
2. **Số điện thoại** (Required) - Phone validation
3. **Email** (Optional) - Email validation
4. **Ngày sinh** (Optional) - Date
5. **Loại khách hàng** (Required) - Dropdown: Cá nhân/Doanh nghiệp/Sinh viên
6. **Đồng ý điều khoản** (Required) - Checkbox

### 5.2 Tạo Form đặt lịch tích điểm

**Form fields:**

1. **Mã khách hàng** (Required) - Text
2. **Ngày sự kiện** (Required) - Date
3. **Loại sự kiện** (Required) - Dropdown
4. **Số người** (Required) - Number
5. **Thời lượng** (Required) - Number (giờ)
6. **Giá trị thanh toán** (Required) - Currency
7. **Ghi chú** (Optional) - Paragraph

### 5.3 Connect Form to Sheets

1. Mở Google Form
2. Click "Responses" → "Link to Sheets"
3. Chọn spreadsheet đã tạo
4. Responses sẽ tự động thêm vào sheet mới
5. Dùng Apps Script để chuyển data vào sheets chính

---

## 6. ZALO NOTIFICATION SETUP

### 6.1 Tạo Zalo OA

1. Truy cập: oa.zalo.me
2. Đăng ký Zalo OA (miễn phí)
3. Xác minh doanh nghiệp
4. Lấy Access Token

### 6.2 Setup Webhook (Optional)

Sử dụng Zalo ZNS (Zalo Notification Service) để gửi thông báo tự động:

**Các sự kiện cần thông báo:**
- Đăng ký thành viên mới
- Tích điểm thành công
- Đạt hạng mới
- Điểm sắp hết hạn (trước 30 ngày)
- Chúc mừng sinh nhật
- Voucher mới

### 6.3 Manual notification (Giai đoạn đầu)

**Template gửi thông báo qua Zalo:**

```
Chào [Tên khách hàng],
Bạn đã nhận được [Số điểm] điểm từ giao dịch [Mã đặt].
Tổng điểm: [Tổng điểm]
Hạng: [Hạng hiện tại]
Tra cứu điểm: bit.ly/sol-diem
```

---

## 7. BẢO MẬT VÀ BACKUP

### 7.1 Phân quyền truy cập

**Roles:**

| Role | View | Edit | Admin |
|-----|------|------|-------|
| Owner | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ |
| Staff | ✅ | ❌ | ❌ |

### 7.2 Backup tự động

1. **Version history**: Google Sheets tự động lưu
2. **Export weekly**: Xuất file CSV mỗi tuần
3. **Cloud backup**: Sync với Google Drive

### 7.3 Lock cells

**Lock formula cells:**
- Chọn các cell chứa formula
- Right-click → Protect range
- Only admin can edit

**Lock header rows:**
- Freeze first row (View → Freeze → 1 row)

---

## 8. GOOGLE APPS SCRIPT (ADVANCED)

### 8.1 Tự động gửi thông báo

```javascript
function sendZaloNotification(email, message) {
  // Integration với Zalo API
  // Cần setup Zalo OA trước
  var accessToken = "YOUR_ACCESS_TOKEN";
  var userId = "USER_ID_FROM_ZALO";

  var payload = {
    recipient: {
      user_id: userId
    },
    message: {
      text: message
    }
  };

  // Send to Zalo API
  // UrlFetchApp.fetch("https://openapi.zalo.me/v2.0/oa/message", ...);
}
```

### 8.2 Tự động tính điểm

```javascript
function autoCalculatePoints() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var bookingSheet = sheet.getSheetByName("LICH_SU_DAT");
  var pointsSheet = sheet.getSheetByName("TIEM_DIEM");

  var lastRow = bookingSheet.getLastRow();

  for (var i = 2; i <= lastRow; i++) {
    var isPaid = bookingSheet.getRange(i, 11).getValue();
    var isPointed = bookingSheet.getRange(i, 12).getValue();

    if (isPaid && !isPointed) {
      var maKH = bookingSheet.getRange(i, 2).getValue();
      var giaTri = bookingSheet.getRange(i, 10).getValue();
      var diem = giaTri / 10000;

      // Add to TIEM_DIEM sheet
      pointsSheet.appendRow([
        "DIEM" + new Date().toISOString().slice(0,10).replace(/-/g,""),
        new Date(),
        maKH,
        bookingSheet.getRange(i, 1).getValue(),
        giaTri,
        diem,
        // ... other fields
      ]);

      // Mark as pointed
      bookingSheet.getRange(i, 12).setValue(true);
    }
  }
}
```

### 8.3 Setup triggers

1. Open Apps Script editor
2. Edit → Current project's triggers
3. Add trigger:
   - Function: `autoCalculatePoints`
   - Event source: `From spreadsheet`
   - On edit: `When form submitted`

---

## 9. CHECKLIST TRIỂN KHAI

### Week 1: Setup
- [ ] Create Google Sheets file
- [ ] Setup all 7 sheets
- [ ] Add formulas
- [ ] Create Google Forms
- [ ] Test with sample data

### Week 2: Testing
- [ ] Test with 5 real customers
- [ ] Fix bugs
- [ ] Train staff
- [ ] Create user manual

### Week 3: Launch
- [ ] Official launch
- [ ] Monitor daily
- [ ] Collect feedback
- [ ] Optimize

---

## 10. TROUBLESHOOTING

### Issue: Formula không hoạt động
- **Solution**: Check locale settings, ensure using proper separator

### Issue: Duplicate entries
- **Solution**: Use Data Validation for unique SDT

### Issue: Slow performance
- **Solution**: Limit data to <5000 rows/sheet, archive old data

### Issue: Permission errors
- **Solution**: Check sharing settings, ensure proper access

---

## 11. NEXT STEPS

Sau khi setup Google Sheets:

1. **Phase 1 (Month 1-3)**: Sử dụng Google Sheets + Zalo manual
2. **Phase 2 (Month 4-6)**: Triển khai Zalo OA với automation
3. **Phase 3 (Month 6+)**: Nâng cấp lên CRM chuyên dụng

---

*Tài liệu này được tạo để hỗ trợ Sol Cafe Coworking triển khai chương trình khách hàng thân thiết một cách hiệu quả và chi phí thấp.*
