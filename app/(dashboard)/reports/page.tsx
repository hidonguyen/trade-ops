// /reports → redirect to the default summary report
import { redirect } from "next/navigation";

export default function ReportsIndexPage() {
  redirect("/reports/summary");
}
