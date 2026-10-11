/** Đường dẫn không có trang nào. Không phải lỗi bay — chỉ là gõ nhầm địa chỉ. */
import { Link, useLocation } from "react-router";

import { IconGeofence } from "@/components/icons";
import { EmptyState } from "@/components/kit";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <EmptyState icon={IconGeofence} title="Ngoài vùng bay">
        <p>
          Không có trang nào ở <span className="font-mono">{pathname}</span>.
        </p>
        <Link to="/" className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Về buồng lái
        </Link>
      </EmptyState>
    </div>
  );
}
