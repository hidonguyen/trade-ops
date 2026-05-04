// Party list — FilterBar + DataTable + Pagination
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { useSelectedBu } from "@/components/providers/bu-provider";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/data-table";
import { FilterBar, FilterConfig } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";

interface Party {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  businessUnit: { code: string; name: string };
}

export default function PartiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBuId, isLoaded: buLoaded } = useSelectedBu();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  // Read initial type filter from URL search params (e.g. /parties?type=CUSTOMER)
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const type = searchParams.get("type");
    return type ? { type } : ({} as Record<string, string>);
  });
  // Sync type filter when URL search params change (soft navigation between sidebar links)
  const urlType = searchParams.get("type");
  useEffect(() => {
    setFilters((prev) => {
      if (urlType && prev.type !== urlType) return { ...prev, type: urlType };
      if (!urlType && prev.type) { const { type: _, ...rest } = prev; return rest; }
      return prev;
    });
    setPage(1);
  }, [urlType]);

  const fetchParties = useCallback(async () => {
    if (!buLoaded || !selectedBuId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("businessUnitId", selectedBuId);
      if (filters.type) params.set("type", filters.type);
      if (filters.search) params.set("search", filters.search);

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
  }, [page, limit, filters, selectedBuId, buLoaded]);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  function handleFilterChange(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  // Type is locked via URL (sidebar menu): no type filter, no type column needed
  const filterConfigs: FilterConfig[] = [
    { key: "search", label: "Tìm kiếm", type: "search", placeholder: "Tìm theo tên..." },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Tên đối tác", sortable: true },
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

  const pageTitle =
    urlType === "CUSTOMER" ? "Khách hàng" : urlType === "SUPPLIER" ? "Nhà cung cấp" : "Đối tác";
  const pageSubtitle =
    urlType === "CUSTOMER"
      ? "Quản lý khách hàng"
      : urlType === "SUPPLIER"
      ? "Quản lý nhà cung cấp"
      : "Quản lý khách hàng và nhà cung cấp";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{pageSubtitle}</p>
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
        onRowClick={(row) => {
          // Preserve origin menu (CUSTOMER/SUPPLIER) so detail page navigates back to the correct list
          const id = (row as unknown as Party).id;
          const from = filters.type ? `?from=${filters.type}` : "";
          router.push(`/parties/${id}${from}`);
        }}
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
