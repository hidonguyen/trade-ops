import { OrderDetailModalProvider } from "@/components/reports/order-detail-modal-provider";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <OrderDetailModalProvider>{children}</OrderDetailModalProvider>;
}
