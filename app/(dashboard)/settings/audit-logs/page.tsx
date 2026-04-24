// Audit log viewer — ADMIN only, filterable, paginated, expandable changes JSON
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlertIcon, ChevronDownIcon, ChevronRightIcon, ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { DateQuickPresets } from "@/components/shared/date-quick-presets";
import { getInitialDateRange, usePersistDateRange } from "@/components/shared/use-persisted-date-range";
import { Pagination } from "@/components/shared/pagination";

interface AuditLog extends Record<string, unknown> {
  id: string;
  action: string;
  model: string;
  recordId: string;
  changes: unknown;
  timestamp: string;
  user: { id: string; name: string; email: string } | null;
}

interface UserOption { id: string; name: string; email: string; }

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Tạo mới" },
  { value: "UPDATE", label: "Cập nhật" },
  { value: "DELETE", label: "Xoá" },
];

const MODEL_OPTIONS = [
  "User", "BusinessUnit", "Currency", "Party", "Order",
  "Transaction", "Deposit", "ExpenseType",
].map((m) => ({ value: m, label: m }));

function ChangesCell({ changes }: { changes: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = changes !== null && changes !== undefined;
  if (!hasData) return <span className="text-slate-400 text-xs">—</span>;

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
      >
        {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
        {expanded ? "Ẩn" : "Xem"}
      </button>
      {expanded && (
        <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 border border-slate-200">
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}
    </div>
  );
}

function buildColumns(): Column<AuditLog>[] {
  return [
    {
      key: "timestamp",
      label: "Thời gian",
      sortable: true,
      render: (val) =>
        val
          ? new Date(String(val)).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
          : "—",
    },
    {
      key: "user",
      label: "Người dùng",
      render: (val: AuditLog["user"]) => val?.name ?? val?.email ?? "—",
    },
    {
      key: "action",
      label: "Hành động",
      render: (val) => {
        const map: Record<string, string> = { CREATE: "Tạo", UPDATE: "Cập nhật", DELETE: "Xoá" };
        return map[String(val)] ?? String(val);
      },
    },
    { key: "model", label: "Đối tượng", sortable: true },
    { key: "recordId", label: "ID bản ghi", render: (val) => <span className="font-mono text-xs">{String(val).slice(0, 8)}…</span> },
    {
      key: "changes",
      label: "Thay đổi",
      render: (val) => <ChangesCell changes={val} />,
    },
  ];
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>(() => ({
    ...getInitialDateRange("audit-logs"),
  }));
  usePersistDateRange("audit-logs", filters.dateFrom, filters.dateTo);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Load user list for filter dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => { if (json.success) setUsers(json.data); })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (f: Record<string, string>, p: number, l: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(l) });
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.status === 403) { setIsAdmin(false); return; }
      const json = await res.json();
      if (json.success) {
        setIsAdmin(true);
        setLogs(json.data);
        setTotal(json.pagination?.total ?? 0);
      } else {
        setError(json.message ?? "Lỗi tải dữ liệu");
      }
    } catch {
      setError("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(filters, page, limit); }, [filters, page, limit, fetchLogs]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const filterConfigs: FilterConfig[] = [
    { key: "dateFrom", label: "Từ ngày", type: "date" },
    { key: "dateTo", label: "Đến ngày", type: "date" },
    {
      key: "userId",
      label: "Người dùng",
      type: "select",
      options: users.map((u) => ({ value: u.id, label: u.name ?? u.email })),
    },
    { key: "model", label: "Đối tượng", type: "select", options: MODEL_OPTIONS },
    { key: "action", label: "Hành động", type: "select", options: ACTION_OPTIONS },
  ];

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlertIcon className="size-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-600">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-400">Chỉ quản trị viên mới có thể xem nhật ký.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật ký hệ thống</h1>
          <p className="mt-0.5 text-sm text-slate-500">Lịch sử thay đổi dữ liệu</p>
        </div>
      </div>

      <FilterBar filters={filterConfigs} onFilterChange={handleFilterChange} values={filters} />
      <DateQuickPresets onSelect={(from, to) => {
        setFilters((prev) => ({ ...prev, dateFrom: from, dateTo: to }));
        setPage(1);
      }} />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
      )}

      <DataTable<AuditLog>
        columns={buildColumns()}
        data={logs}
        loading={loading}
        emptyMessage="Không có nhật ký nào"
        rowKey={(r) => r.id}
      />

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />
    </div>
  );
}
