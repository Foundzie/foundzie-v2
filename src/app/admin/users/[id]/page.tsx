// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

export default function AdminEditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(String(params?.id ?? "").trim());
  return <EditUserClient id={id} />;
}
