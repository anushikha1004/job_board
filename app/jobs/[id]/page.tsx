import JobDetailClient from '@/components/JobDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;
  return <JobDetailClient jobId={id} />;
}
