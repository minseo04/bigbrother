import { SharedView } from '@/components/shared-view';
export const metadata = {
  title: 'Shared board — Big Brother',
  description:
    'A read-only board of entities, connections and the public sources behind them.',
};
export default async function SharedBoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedView token={token} />;
}
