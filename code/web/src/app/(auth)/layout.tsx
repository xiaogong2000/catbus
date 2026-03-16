import { Card } from "@/components/ui/card";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[480px]">
        <Card hoverable={false} glass className="p-8">
          {children}
        </Card>
      </div>
    </div>
  );
}
