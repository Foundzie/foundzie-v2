// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

// Don't over-specify the props type. Handle both plain object and Promise.
export default async function AdminEditUserPage({ params }: any) {
  const resolvedParams = typeof params?.then === "function" ? await params : params;
  const id = decodeURIComponent(String(resolvedParams?.id ?? "").trim());
  return <EditUserClient id={id} />;
}
