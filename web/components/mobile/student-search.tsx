"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type MobileStudentSearchItem = {
  id: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  campusName: string;
};

type StudentSearchProps = {
  onSelect: (student: MobileStudentSearchItem) => void;
};

export function StudentSearch({ onSelect }: StudentSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MobileStudentSearchItem[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await api.get<MobileStudentSearchItem[]>(
        `/api/mobile/students/search?q=${encodeURIComponent(trimmed)}&limit=12`,
      );

      if (result.ok) {
        setResults(result.data);
      } else {
        setResults([]);
      }
      setLoading(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name / GR / Mobile"
          className="h-11 pl-9"
        />
      </div>

      {loading ? (
        <p className="px-1 text-xs text-muted-foreground">Searching students...</p>
      ) : null}

      {results.length ? (
        <Card>
          <CardContent className="max-h-64 space-y-1 overflow-y-auto p-2">
            {results.map((student) => (
              <Button
                key={student.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2 text-left"
                onClick={() => onSelect(student)}
              >
                <div>
                  <p className="text-sm font-medium leading-tight">
                    {student.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {student.admissionNo} - {student.grade} - {student.campusName}
                  </p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
