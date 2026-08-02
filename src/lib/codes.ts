/** Encurta números de cliente e códigos derivados para visualização.
 *  C00007 -> C07 · C01-OC-2026-00001 -> C01-OS01 · C01-VCH-2026-00003 -> C01-VCH03 */
export function shortCode(v?: string | null): string {
  if (!v) return "—";
  const pad = (d: string) => String(Number(d)).padStart(2, "0");
  return String(v)
    // C01-OC-2026-00001 / C01-OC001 -> C01-OS01
    .replace(/OC-?(?:\d{4}-)?0*(\d+)/g, (_m, d) => `OS${pad(d)}`)
    .replace(/OC(?=\d)/g, "OS")
    // C01-VCH-2026-00001 -> C01-VCH01
    .replace(/(VCH|VC)-?(?:\d{4}-)?0*(\d+)/g, (_m, p, d) => `${p}${pad(d)}`)
    // C00007 -> C07
    .replace(/C0*(\d+)(?!\d)/g, (_m, d) => `C${pad(d)}`);
}
