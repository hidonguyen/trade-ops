# Prompt cho Claude Code — TradeOps: Bổ sung báo cáo & điều chỉnh đơn hàng

## 1. Module Đơn hàng Bán (`sale-orders`)

### 1.1. Bổ sung thông tin đơn hàng

- **Tỷ giá + Tiền quy đổi**: thêm `exchangeRate` (Decimal, bắt buộc khi `currency != 'VND'`). Hiển thị derived field `orderValue × exchangeRate` (quy ra VND) ở UI.
- **Ngày hạn thanh toán** (`paymentDueDate`): kiểu `Date`, **nullable** (cho phép để trống). Hiển thị thêm cột này ở list đơn hàng (ngoài danh sách).
- **Thanh toán loại "Điều chỉnh giá trị đơn hàng"**:
  - Thêm giá trị mới vào enum `TransactionType` (hoặc cơ chế tương đương hiện có).
  - **Cho phép nhập số âm** — dùng để giảm giá đơn hàng (đây là vấn đề "giảm giá chưa test được" được ghi chú trong mẫu báo cáo).
  - Ở màn Chi tiết đơn hàng, phần **Tổng kết thanh toán** bổ sung chỉ tiêu **"Điều chỉnh giá trị đơn hàng"** = tổng các transaction loại này (có dấu).
  - Công thức **Còn phải thanh toán** = `orderValue + điều_chỉnh − đã_thanh_toán` (điều chỉnh âm sẽ giảm công nợ).

### 1.2. Xuất Excel — Báo cáo TỔNG HỢP bán hàng

Tham chiếu sheet **"ban hang TH (2)"** — 11 cột.

| # | Cột | Ghi chú |
|---|-----|---------|
| 1 | ĐƠN VỊ | e.g., "TK" |
| 2 | ĐỐI TÁC | Mã KH |
| 3 | SỐ ĐƠN | |
| 4 | NGÀY ĐƠN HÀNG | |
| 5 | HẠN THANH TOÁN | Để trống nếu null |
| 6 | TIỀN TỆ | VND / USD / RMB / … |
| 7 | GIÁ TRỊ ĐƠN HÀNG | Nguyên tệ |
| 8 | GIẢM GIÁ TRỊ ĐƠN HÀNG | Tổng adjustment (hiển thị dương) |
| 9 | ĐÃ THANH TOÁN | Tổng các khoản thu |
| 10 | CÒN PHẢI THANH TOÁN | = (7) − (8) − (9) |
| 11 | TRẠNG THÁI | |

**Logic nhóm:**
- Nhóm theo `customer × currency`.
- Sau mỗi nhóm: chèn **dòng subtotal** với nhãn ở cột 2 = `"{customerCode}-{currency}"` (ví dụ `KH001-USD`), tổng các cột 7, 8, 9, 10.
- Chèn 1 dòng trống giữa các nhóm.
- Cuối sheet: **dòng Grand total theo currency** — nhãn ở cột 6 = `"Grand-{currency}"` (ví dụ `Grand-USD`, `Grand-VND`, `Grand-RMB`), mỗi currency 1 dòng.

### 1.3. Xuất Excel — Báo cáo CHI TIẾT bán hàng

Tham chiếu sheet **"ban hang chi tiet (2)"** — 13 cột.

| # | Cột | Ghi ở dòng payment | Ghi ở dòng Total |
|---|-----|--------------------|------------------|
| 1 | ĐƠN VỊ | ✓ | ✓ |
| 2 | ĐỐI TÁC | ✓ | ✓ |
| 3 | SỐ ĐƠN | `{mã đơn}` | `{mã đơn}-Total` |
| 4 | NGÀY ĐƠN HÀNG | ✓ | ✓ |
| 5 | TIỀN TỆ | ✓ | ✓ |
| 6 | GIÁ TRỊ ĐƠN HÀNG | — | ✓ |
| 7 | GIẢM GIÁ TRỊ ĐƠN HÀNG | — | ✓ |
| 8 | HẠN THANH TOÁN | ✓ | ✓ |
| 9 | NGÀY THANH TOÁN | Ngày từng GD | — |
| 10 | THANH TOÁN LẦN NÀY | Số tiền mỗi GD | Tổng đã thanh toán |
| 11 | CÒN PHẢI THANH TOÁN | — | ✓ |
| 12 | TRẠNG THÁI | | ✓ |
| 13 | GHI CHÚ | | ✓ |

**Logic nhóm:**
- Mỗi đơn hàng có N dòng payment (1 dòng / lần thanh toán).
- Kết thúc mỗi đơn: 1 dòng Total như bảng trên.
- Chèn 1 dòng trống giữa các đơn.
- Cuối sheet: Grand total theo currency (cột 5 = `Grand-{currency}`), tổng các cột 6, 7, 10, 11.

---

## 2. Module Đơn hàng Mua (`purchase-orders`)

### 2.1. Bổ sung thông tin đơn hàng

Hoàn toàn giống §1.1 — apply cho purchase order:
- Tỷ giá + tiền quy đổi VND
- `paymentDueDate` nullable, hiển thị cột ngoài list
- Transaction loại "Điều chỉnh giá trị đơn hàng" (âm được), vào Tổng kết thanh toán

### 2.2. Xuất Excel — Báo cáo TỔNG HỢP mua hàng

Tham chiếu sheet **"mua hang TH (2)"** — **12 cột** (thêm `LOẠI CHI PHÍ` so với sales).

Cột: `ĐƠN VỊ | ĐỐI TÁC (NCC) | SỐ ĐƠN | NGÀY ĐH | HẠN TT | TIỀN TỆ | GIÁ TRỊ ĐH | GIẢM GIÁ TRỊ ĐH | ĐÃ TT | CÒN PHẢI TT | TRẠNG THÁI | LOẠI CHI PHÍ`

Giá trị `LOẠI CHI PHÍ` tham chiếu trong mẫu: "Mua vật tư", "Chi phí tiện ích", "Chi phí khác" — xem §3.

Logic nhóm + subtotal + grand total giống §1.2.

### 2.3. Xuất Excel — Báo cáo CHI TIẾT mua hàng

Tham chiếu sheet **"mua hang chi tiet (2)"** — **14 cột**, thêm `LOẠI CHI PHÍ` ở cột 13 (trước `GHI CHÚ`).

Logic giống §1.3.

---

## 3. Giao dịch Thu Chi (`transactions` / `cashflow`)

- Thêm field **`expenseCategory`** (Loại chi phí). Bạn (Claude Code) tự đề xuất: enum cố định hay FK tới bảng `ExpenseCategory` — cân nhắc bảo trì, i18n, và nhu cầu NSD thêm giá trị mới sau này.
- **Giá trị seed tối thiểu**: `"Mua vật tư"`, `"Chi phí tiện ích"`, `"Chi phí khác"`, `"Phí ngân hàng"`, `"Cọc"`.
- **Filter** theo `expenseCategory` ở list Giao dịch.
- **Hiển thị** cột này ở list & detail.
- Field này phục vụ cả Purchase Order (§2.2, §2.3) lẫn Báo cáo tổng hợp Thu Chi (§4).

---

## 4. Báo cáo Tổng hợp Thu Chi — xuất Excel

Tham chiếu sheet **"ThuChi (BAOCAO TONGHOP HIEN TẠI"**.

### 4.1. Cấu trúc sheet

```
III. Các Khoản Phải Thu
  1. TK
    a. Thu từ khách hàng
       Header: STT | Khách hàng | Mã ĐH | Ngày tháng | Tiền tệ
             | Nợ cũ (Nguyên tệ) | TT lần này (Nguyên tệ) | Nợ còn lại (Nguyên tệ)
             | Số tiền quy ra VNĐ | Ghi chú
       → TỔNG CỘNG

    b. Thu khác
       Header: STT | Ngày phát sinh | Người nộp | Nội dung/Diễn giải
             | Phương thức thanh toán | Mã tham chiếu | Tiền tệ | Nguyên tệ
             | Số tiền quy ra VNĐ | Ghi chú
       → Phân nhóm theo PTTT: "Ngân hàng", "Cọc", …
       → TỔNG CỘNG

IV. Các Khoản Phải Trả
  1. TK
    a. Phải trả nhà cung cấp   (cấu trúc giống III.1.a)
       → TỔNG CỘNG

    b. Chi khác                (cấu trúc giống III.1.b)
       → Gồm: Phí ngân hàng gom chung, Cọc NCC, các khoản chi khác
       → TỔNG CỘNG
```

### 4.2. Yêu cầu đặc biệt (từ sheet "Nội dung khác")

- **Phí ngân hàng**: mỗi giao dịch đánh dấu "có phí ngân hàng" tự đẩy khoản phí đó xuống **IV.1.b Chi khác**.
- **Icon tiền tệ**: hiển thị đúng với tiền tệ thực tế của giao dịch + phí.
- **Quy đổi VNĐ**: review công thức (nhập tay, không dùng ExchangeRate lookup).
- **Báo cáo cọc**: cột "số dư" hiện số dư sau thời điểm phát sinh (running balance).
- **Báo cáo dòng tiền**:
  - Hiển thị khoản cọc.
  - **Bỏ** khoản thanh toán từ cọc (cọc đã ghi nhận lúc đặt — tránh tính 2 lần).

---

## 5. Yêu cầu chung cho mọi file Excel xuất ra

- Dùng **exceljs** (đã trong stack).
- Filter mặc định: range `Từ ngày … Đến ngày` (UI truyền vào, hiển thị ở dòng 2 của sheet).
- Header in đậm, căn giữa, background xám nhạt.
- Dòng subtotal / grand total: background vàng nhạt hoặc xám.
- Số tiền format `#,##0`, không ký tự tiền tệ ở cell (cột tiền tệ riêng).
- Merge cell tiêu đề "BÁO CÁO …" ở dòng 1.
- Ngày format `dd/MM/yyyy`.
- **Không dùng formula Excel** — tính sẵn ở backend rồi ghi value (dữ liệu lớn, không cần reactive).
- Tên file tải xuống: `bao-cao-{loai}-{yyyyMMdd}-{yyyyMMdd}.xlsx`.

---

## 6. Edge case cần cover trong plan

- Đơn hàng có nhiều tiền tệ khác nhau cùng 1 đối tác (mẫu KH001 có USD, VND, RMB — mỗi currency là 1 subtotal riêng).
- Đơn hàng chưa có thanh toán nào (008-ND trong mẫu).
- Đơn hàng đã thanh toán đủ (009-TM, 008-ND).
- Đơn hàng có adjustment âm (001-TN giảm giá 10.000.000 trong mẫu (2)).
- `paymentDueDate` = null (đơn hàng cũ trước khi thêm field).
- Đơn hàng cũ chưa có `exchangeRate` sau migration — cần default value sao cho không break report.
- Transaction có phí ngân hàng kèm theo.
- Transaction từ cọc (không tính vào dòng tiền).
