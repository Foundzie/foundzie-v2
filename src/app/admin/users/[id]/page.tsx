// src/app/admin/users/[id]/page.tsx
import EditUserClient from "./EditUserClient";

// your app gives params as a Promise<{ id: string }>
export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditUserClient id={id} />;
}