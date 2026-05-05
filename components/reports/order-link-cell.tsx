"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useOrderDetailModal } from "./order-detail-modal-provider";

export function OrderLinkCell({ orderId }: { orderId: string | null | undefined }) {
  const modal = useOrderDetailModal();
  if (!orderId) return <span className="text-gray-300">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        modal.open(orderId);
      }}
      className="inline-flex items-center text-blue-600 hover:text-blue-800"
      title="Xem chi tiết đơn hàng"
    >
      <ExternalLinkIcon className="w-4 h-4" />
    </button>
  );
}
