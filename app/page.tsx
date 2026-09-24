import VolumeDashboard from '@/components/VolumeDashboard';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <VolumeDashboard />
    </main>
  );
}
