import { CourseBuilder } from './builder';

export default async function KursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseBuilder courseId={id} />;
}
