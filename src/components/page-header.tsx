import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
