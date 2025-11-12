// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

export default function AdminEditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  return <EditUserClient id={id} />;
}
