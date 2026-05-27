-- Composite indexes to speed up the order list page (orders.tsx):
-- query pattern is WHERE businessUnitId=? [AND type=?] ORDER BY orderDate DESC, orderNumber ASC LIMIT N.
-- Without these, postgres falls back to Parallel Seq Scan + top-N heapsort (~300ms @ 1M rows).
-- With these, planner uses an Index Scan with native order so LIMIT 25 returns in sub-millisecond.

CREATE INDEX IF NOT EXISTS "Order_bu_orderDate_idx"
  ON "Order" ("businessUnitId", "orderDate" DESC, "orderNumber" ASC);

CREATE INDEX IF NOT EXISTS "Order_bu_type_orderDate_idx"
  ON "Order" ("businessUnitId", type, "orderDate" DESC, "orderNumber" ASC);
