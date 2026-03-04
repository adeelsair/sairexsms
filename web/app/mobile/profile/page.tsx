"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MobileProfilePage() {
  return (
    <div className="space-y-4 p-4 pb-20">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          User profile settings will be expanded in upcoming phases.
        </CardContent>
      </Card>
    </div>
  );
}
