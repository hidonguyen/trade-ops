# Summary Report DOCX Export

**Created:** 2026-04-20
**Status:** completed
**Priority:** high
**Complexity:** medium (new API route + new lib service + button on page)

## Summary

Add "Xuất báo cáo tổng hợp" button to summary report page. Generates a .docx file with structured sections per business unit.

## DOCX Structure

```
BÁO CÁO TỔNG HỢP THU CHI
Kỳ: [dateFrom] - [dateTo]

I. CÁC KHOẢN THU

1. TK (tên đơn vị)
   a. Thu từ khách hàng
   [Table: STT | Khách hàng | Mã ĐH | Ngày tháng | Nợ cũ | TT lần này | Nợ còn lại | Ghi chú]
   
   b. Thu khác
   [Table: STT | Ngày | Số tiền | Tiền tệ | Phương thức | Tham chiếu | Ghi chú]

2. NT (tên đơn vị)
   a. Thu từ khách hàng
   ...

II. CÁC KHOẢN CHI

1. TK (tên đơn vị)
   a. Chi trả nhà cung cấp
   [Table: STT | NCC | Mã ĐH | Ngày tháng | Nợ cũ | TT lần này | Nợ còn lại | Ghi chú]
   
   b. Chi khác
   [Table: STT | Ngày | Số tiền | Tiền tệ | Phương thức | Tham chiếu | Ghi chú]

2. NT (tên đơn vị)
   ...
```

## Phases

Single phase — API endpoint + DOCX generation service + page button.

## Implementation Steps

### 1. Install `docx` package
```bash
npm install docx
```

### 2. Create DOCX generation service
File: `lib/docx-summary-export-service.ts`
- Accept summary data grouped by BU
- Generate structured DOCX with sections, headings, tables
- Return Buffer

### 3. Create API endpoint
File: `app/api/reports/summary/export/route.ts`
- Same query params as summary API (businessUnitId is optional — export ALL active BUs)
- Fetch data for each active BU
- Generate DOCX, return as download

### 4. Add export button to page
File: `app/(dashboard)/reports/summary/page.tsx`
- "Xuất báo cáo tổng hợp" button next to CSV export
- Opens URL: `/api/reports/summary/export?dateFrom=X&dateTo=Y`

## Key Decisions
- Export ALL active BUs (not just selected) — comprehensive report
- Uses `docx` npm package (standard for Node.js DOCX generation)
- Tables have borders and headers styled bold
- Vietnamese text throughout

## Dependencies
- npm package: `docx` (new dependency)
- Depends on summary report API data shape (already implemented)
