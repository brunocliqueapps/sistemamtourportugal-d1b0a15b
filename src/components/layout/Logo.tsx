import logoAsset from "@/assets/mtour-logo.asset.json";

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={logoAsset.url} alt="Mtour Portugal" className={className} />;
}
