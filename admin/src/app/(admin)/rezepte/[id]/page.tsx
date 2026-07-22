import { RecipeEditor } from './editor';

export default async function RezeptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeEditor recipeId={id === 'neu' ? null : Number(id)} />;
}
