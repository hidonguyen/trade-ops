---
title: "Replace Tổng quan with welcome screen"
description: "Remove dashboard KPI/charts page; replace root / with simple welcome (greeting + date/time + app info). Drop unused API + components."
status: completed
priority: P3
effort: 1h
branch: main
tags: [ui, cleanup]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Replace Overview with Welcome

## Context
- `/` route currently renders KPI cards + charts (Tổng quan).
- User wants it gone: replace with simple welcome card (greeting, current date/time, app info). Login still redirects to `/`.
- Verified no other consumer of `/api/reports/dashboard`, `components/dashboard-charts.tsx`, `components/kpi-card.tsx`.

## Decisions (confirmed)
1. Keep the `/` route — replace content (don't 404 or delete).
2. Welcome content: greeting (time-based: Chào buổi sáng/chiều/tối), formatted current date/time (vi-VN), app name + version/short description.
3. Delete dead code: API route + 2 components.

## Files
**Modify:**
- `app/(dashboard)/page.tsx` — replace entire content with simple welcome component.

**Delete:**
- `app/api/reports/dashboard/route.ts`
- `components/dashboard-charts.tsx`
- `components/kpi-card.tsx`

**Verify after:** no broken imports (`grep -rn "kpi-card\|dashboard-charts\|/api/reports/dashboard"`), `tsc --noEmit` clean.

## Implementation Sketch

```tsx
// app/(dashboard)/page.tsx
"use client";
import { useEffect, useState } from "react";

const APP_NAME = "Trade Ops";
const APP_DESC = "Hệ thống quản lý đơn hàng, công nợ và dòng tiền";

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function HomePage() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!now) return null;
  const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("vi-VN");
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">{greeting(now)}!</h1>
        <p className="text-lg text-slate-600">{dateStr}</p>
        <p className="text-2xl font-mono text-slate-700">{timeStr}</p>
        <div className="pt-6 text-sm text-slate-500">
          <p className="font-medium">{APP_NAME}</p>
          <p>{APP_DESC}</p>
        </div>
      </div>
    </div>
  );
}
```

SSR-safe via `now === null` guard until client mount.

## Phases
Single phase — no breakdown needed.

## Todo
- [ ] Replace `app/(dashboard)/page.tsx` with welcome component
- [ ] Delete `app/api/reports/dashboard/route.ts`
- [ ] Delete `components/dashboard-charts.tsx`
- [ ] Delete `components/kpi-card.tsx`
- [ ] Grep verify no orphan imports
- [ ] `tsc --noEmit` clean

## Success Criteria
- `/` shows greeting + date/time + app name; clock updates each second.
- No broken imports; build clean.
- Login redirect still works.

## Rollback
`git revert`. No schema/data change.

## Open Questions
None.
