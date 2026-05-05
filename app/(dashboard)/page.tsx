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

  const dateStr = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
