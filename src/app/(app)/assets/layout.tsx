import { AssetsTabs } from "./tabs";

export default function AssetsLayout({ children }: LayoutProps<"/assets">) {
  return (
    <div className="flex flex-col gap-5">
      <AssetsTabs />
      {children}
    </div>
  );
}
