interface RowPair {
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
}

/** Fields that changed between old and new rows (ignores generated/search columns). */
export function changedFields(r: RowPair): string[] {
  if (!r.old_row || !r.new_row) return [];
  return Object.keys({ ...r.old_row, ...r.new_row }).filter((k) => k !== "search" && k !== "updated_at" && JSON.stringify(r.old_row![k]) !== JSON.stringify(r.new_row![k]));
}
