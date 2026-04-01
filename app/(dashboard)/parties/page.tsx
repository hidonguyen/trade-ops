// Party list — FilterBar + DataTable + Pagination
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";

interface BusinessUnit { id: string; code: string; name: string; }
interface Party {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  businessUnit: { code: string; name: string };
}

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Khách hàng",
  SUPPLIER: "Nhà cung cấp",
  BOTH: "KH & NCC",
};

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);

  // Fetch BU list for filter options once
  useEffect(() => {
    fetch("/api/business-units")
      .then((r) => r.json())
      .then((j) => { if (j.success) setBusinessUnits(j.data); })
      .catch(() => {});
  }, []);

  const fetchParties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);
      if (filters.businessUnitId) params.set("businessUnitId", filters.businessUnitId);

      const res = await fetch(`/api/parties?${params}`);
      const json = await res.json();
      if (json.success) {
        setParties(json.data);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  function handleFilterChange(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const filterConfigs: FilterConfig[] = [
    {
      key: "type", label: "Loại đối tác", type: "select",
      options: [
        { value: "CUSTOMER", label: "Khách hàng" },
        { value: "SUPPLIER", label: "Nhà cung cấp" },
        { value: "BOTH", label: "KH & NCC" },
      ],
    },
    {
      key: "businessUnitId", label: "Đơn vị KD", type: "select",
      options: businessUnits.map((bu) => ({ value: bu.id, label: `${bu.code} — ${bu.name}` })),
    },
    { key: "search", label: "Tìm kiếm", type: "search", placeholder: "Tìm theo tên..." },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Tên đối tác", sortable: true },
    {
      key: "type", label: "Loại",
      render: (v) => <span className="text-sm text-slate-600">{TYPE_LABELS[String(v)] ?? String(v)}</span>,
    },
    {
      key: "businessUnit", label: "Đơn vị",
      render: (v) => {
        const bu = v as Party["businessUnit"];
        return <span className="text-sm">{bu?.code}</span>;
      },
    },
    { key: "phone", label: "Điện thoại", render: (v) => <span>{String(v ?? "—")}</span> },
    { key: "email", label: "Email", render: (v) => <span className="text-slate-500">{String(v ?? "—")}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Đối tác</h1>
          <p className="text-sm text-slate-500">Quản lý khách hàng và nhà cung cấp</p>
        </div>
        <Button size="sm" onClick={() => router.push("/parties/new")}>
          <PlusIcon className="size-4 mr-1" />Thêm đối tác
        </Button>
      </div>

      <FilterBar filters={filterConfigs} values={filters} onFilterChange={handleFilterChange} />

      <DataTable
        columns={columns}
        data={parties as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không tìm thấy đối tác nào"
        onRowClick={(row) => router.push(`/parties/${(row as unknown as Party).id}`)}
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
