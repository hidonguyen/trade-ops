# Cost Estimate — RBAC per Business Unit

> Báo giá tham khảo cho khách hàng. Đơn giá USD và VND. Tỷ giá quy ước: 1 USD ≈ 25.500 VND. Điều chỉnh theo rate dev team thực tế.

## Tổng quan công sức
| Phase | Hạng mục | Giờ |
|---|---|---:|
| 1 | Schema + Prisma migration + backfill SQL + seed | 4 |
| 2 | RBAC helper refactor + JWT/session + types | 5 |
| 3 | API enforcement (~101 callsites, ~30 routes) | 8 |
| 4 | UI: matrix assignment + BU switcher + gating sweep | 6 |
| 5 | List/report filtering theo BU access | 3 |
| 6 | Unit tests + docs update | 2 |
| — | QA round 1 + bugfix buffer (15%) | 4 |
| — | Deploy + giám sát + hotfix (1 tuần) | 2 |
| **Total** | | **34h** |

## Báo giá theo 3 mức rate (tham khảo TT Việt Nam, 2026)

| Mức | Rate / giờ | Tổng (34h) | Tổng (VND) |
|---|---:|---:|---:|
| **Junior / outsource giá rẻ** | 15 USD | 510 USD | ~13.000.000 ₫ |
| **Mid-level (khuyến nghị)** | 30 USD | 1.020 USD | ~26.000.000 ₫ |
| **Senior / freelancer có kinh nghiệm Next.js + RBAC** | 50 USD | 1.700 USD | ~43.500.000 ₫ |

> Khuyến nghị **mid-level**: tính chất công việc là refactor mechanical + 1 schema migration + UI form, không yêu cầu R&D, nhưng cần cẩn thận để không làm hỏng quyền hiện tại.

## Báo giá fixed-price gợi ý cho khách
- **Gói tiêu chuẩn:** **30.000.000 ₫** (~1.180 USD)
  - Bao gồm: 6 phase + test cơ bản + tài liệu + 1 tuần bảo hành lỗi.
  - Thời gian giao hàng: **5–7 ngày làm việc**.
- **Gói mở rộng:** **+5.000.000 ₫** nếu khách yêu cầu:
  - Audit log riêng cho thay đổi phân quyền.
  - Trang admin xem ma trận quyền của tất cả user (read-only report).
  - E2E tests (Playwright) cho 3 luồng chính.

## Giả định (in báo giá để tránh tranh cãi)
- Số Business Unit hiện tại: 2 (TK, NT). Nếu > 5, UI matrix cần phân trang (+2h).
- Không thay đổi danh sách 5 role hiện có và ma trận `permissionMatrix`.
- Số route API ≤ 35. Nếu phát sinh module mới trong lúc làm, tính thêm theo giờ.
- Test framework chưa cấu hình → unit test viết bằng `node --test` hoặc cấu hình Vitest tối thiểu (đã tính trong 2h).
- Migration chạy trên DB production có ≤ 50 user. User > 200 cần script backfill batched (+1h).
- Khách cung cấp môi trường staging để verify trước khi deploy production.

## Ngoài phạm vi (out of scope)
- Phân quyền theo từng record (row-level) ngoài BU — ví dụ "chỉ xem đơn của khách mình tạo".
- Approval workflow nhiều cấp.
- SSO / Active Directory integration.
- Audit log UI (hiện chỉ có audit trail trong DB).

## Điều khoản thanh toán đề xuất
- 50% khi ký hợp đồng / start.
- 40% khi nghiệm thu staging.
- 10% sau 7 ngày bảo hành production.
