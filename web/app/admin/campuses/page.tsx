"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxStatusBadge,
  SxDataTable,
  type SxColumn,
} from "@/components/sx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ── Types ─────────────────────────────────────────────────── */

interface GeoCity {
  id: string;
  name: string;
}

interface GeoZone {
  id: string;
  name: string;
  cityId: string;
}

interface Campus {
  id: number;
  name: string;
  campusCode: string;
  unitCode: string;
  fullUnitPath: string;
  status: string;
  organizationId: string;
  cityId: string;
  zoneId: string | null;
  organization: { id: string; organizationName: string };
  city: { id: string; name: string; unitCode: string; region?: { id: string; name: string; unitCode: string } | null };
  zone: { id: string; name: string; unitCode: string } | null;
}

/* ── Zod schema ────────────────────────────────────────────── */

const campusSchema = z.object({
  name: z.string().min(1, "Campus name is required"),
  cityId: z.string().min(1, "City is required"),
  zoneId: z.string().optional(),
});

type CampusFormValues = z.infer<typeof campusSchema>;

/* ── Column definitions ────────────────────────────────────── */

const columns: SxColumn<Campus>[] = [
  {
    key: "fullUnitPath",
    header: "Unit Path",
    render: (row) => (
      <span className="font-data font-medium text-primary tracking-wide">{row.fullUnitPath}</span>
    ),
  },
  {
    key: "name",
    header: "Campus Name",
    render: (row) => (
      <div>
        <div className="font-medium">{row.name}</div>
        <div className="text-xs text-muted-foreground font-data">{row.campusCode}</div>
      </div>
    ),
  },
  {
    key: "organization",
    header: "Organization",
    render: (row) => (
      <span className="text-muted-foreground">{row.organization?.organizationName}</span>
    ),
  },
  {
    key: "city",
    header: "City",
    render: (row) => (
      <div>
        <div>{row.city?.name}</div>
        {row.city?.region && (
          <div className="text-xs text-muted-foreground">{row.city.region.name}</div>
        )}
      </div>
    ),
  },
  {
    key: "zone",
    header: "Zone",
    render: (row) =>
      row.zone ? (
        <SxStatusBadge variant="info">{row.zone.name}</SxStatusBadge>
      ) : (
        <span className="text-xs text-muted-foreground italic">—</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <SxStatusBadge status={row.status} />,
  },
];

/* ── Page component ────────────────────────────────────────── */

export default function CampusesPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [zones, setZones] = useState<GeoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [camResult, geoResult] = await Promise.all([
      api.get<Campus[]>("/api/campuses"),
      api.get<{ cities: GeoCity[]; zones: GeoZone[] }>("/api/regions"),
    ]);
    if (camResult.ok) setCampuses(camResult.data);
    else toast.error(camResult.error);
    if (geoResult.ok) {
      setCities(geoResult.data.cities);
      setZones(geoResult.data.zones);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const form = useForm<CampusFormValues>({
    resolver: zodResolver(campusSchema),
    defaultValues: { name: "", cityId: "", zoneId: "" },
  });

  const { handleSubmit, reset, watch, formState: { isSubmitting } } = form;
  const selectedCityId = watch("cityId");

  const filteredZones = useMemo(
    () => (selectedCityId ? zones.filter((z) => z.cityId === selectedCityId) : []),
    [zones, selectedCityId],
  );

  const onSubmit = async (data: CampusFormValues) => {
    const result = await api.post<Campus>("/api/campuses", {
      ...data,
      zoneId: data.zoneId || null,
    });
    if (result.ok) {
      toast.success("Campus registered successfully");
      setIsDialogOpen(false);
      reset();
      fetchData();
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        form.setError(field as keyof CampusFormValues, { message: messages[0] });
      }
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) reset();
  };

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Campuses"
        subtitle="Manage school branches and operational units"
        actions={
          <SxButton sxVariant="primary" icon={<Plus size={16} />} onClick={() => setIsDialogOpen(true)}>
            Add Campus
          </SxButton>
        }
      />

      <SxDataTable
        className="rounded-xl border-border bg-surface"
        columns={columns as unknown as SxColumn<Record<string, unknown>>[]}
        data={campuses as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="No campuses found. Register one to get started."
      />

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Campus</DialogTitle>
            <DialogDescription>Add a new school branch under an organization.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Campus Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Islamabad Campus" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="cityId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <Select value={field.value} onValueChange={(val) => { field.onChange(val); form.setValue("zoneId", ""); }}>
                      <FormControl>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select city" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="zoneId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone (optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={!selectedCityId || filteredZones.length === 0}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={selectedCityId ? (filteredZones.length > 0 ? "Select zone" : "No zones") : "Select city first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {filteredZones.map((z) => (
                          <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <SxButton type="button" sxVariant="outline" onClick={() => handleOpenChange(false)}>Cancel</SxButton>
                <SxButton type="submit" sxVariant="primary" loading={isSubmitting}>Register Campus</SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
