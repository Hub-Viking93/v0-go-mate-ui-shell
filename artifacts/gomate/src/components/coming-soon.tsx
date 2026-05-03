import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-6 md:p-8 lg:p-10">
      <Card className="p-12 text-center max-w-2xl mx-auto">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Construction className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground">
          {description || "This page is being migrated. The full feature is coming soon."}
        </p>
      </Card>
    </div>
  );
}
