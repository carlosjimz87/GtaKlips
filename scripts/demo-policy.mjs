// Existing local editions are immutable to the seeder, including manual withdrawals.
export function demoNeedsWrite(existing, expected) {
  if (!existing) return true;
  if (existing.draft === expected && existing.published === expected) return false;
  throw Error("Ya hay una edición propia o modificada en la fecha de hoy. Se conserva y no se sobrescribe.");
}
