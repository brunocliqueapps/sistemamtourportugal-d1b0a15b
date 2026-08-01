/** Encurta números de cliente e códigos derivados para visualização.
 *  C00007 -> C07 · C00007-OC001 -> C07-OS001 */
export function shortCode(v?: string | null): string {
  if (!v) return "—";
  return String(v)
    .replace(/C0*(\d+)/g, (_m, d) => `C${String(Number(d)).padStart(2, "0")}`)
    .replace(/OC(?=\d)/g, "OS");
}
