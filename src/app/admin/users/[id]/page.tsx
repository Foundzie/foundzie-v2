// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

export default async function AdminEditUserPage({ params }: any) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  const id = decodeURIComponent(String(resolvedParams?.id ?? "").trim());
  return <EditUserClient id={id} />;
}
