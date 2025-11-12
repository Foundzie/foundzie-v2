// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditUserClient id={id} />;
}
