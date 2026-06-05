import { AccountDetailClient } from "./account-detail-client";

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;

  return <AccountDetailClient accountId={id} />;
}
