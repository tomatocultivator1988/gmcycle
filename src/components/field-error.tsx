export function FieldError({ error }: { error?: string }) {
  if (!error) return null;

  return <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>;
}
