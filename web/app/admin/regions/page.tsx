"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, MapPin, Building, Layers, Navigation } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ── Types ─────────────────────────────────────────────────── */

interface GeoRegion {
  id: string;
  name: string;
  unitCode: string;
}

interface GeoSubRegion {
  id: string;
  name: string;
  unitCode: string;
  regionId: string | null;
}

interface GeoCity {
  id: string;
  name: string;
  unitCode: string;
  regionId: string | null;
  subRegionId: string | null;
}

interface GeoZone {
  id: string;
  name: string;
  unitCode: string;
  cityId: string;
}

type GeoType = "region" | "subRegion" | "city" | "zone";

/* ── Zod schemas ───────────────────────────────────────────── */

const regionSchema = z.object({
  name: z.string().min(1, "Region name is required"),
});

const subRegionSchema = z.object({
  name: z.string().min(1, "Sub-region name is required"),
  regionId: z.string().optional(),
});

const citySchema = z.object({
  name: z.string().min(1, "City name is required"),
  regionId: z.string().optional(),
  subRegionId: z.string().optional(),
});

const zoneSchema = z.object({
  name: z.string().min(1, "Zone name is required"),
  cityId: z.string().min(1, "City is required"),
});

/* ── Column definitions ────────────────────────────────────── */

const regionColumns: SxColumn<GeoRegion>[] = [
  { key: "unitCode", header: "Code", render: (r) => <span className="font-data font-medium text-primary">{r.unitCode}</span> },
  { key: "name", header: "Region Name", render: (r) => <span className="font-medium">{r.name}</span> },
];

const subRegionColumns = (regions: GeoRegion[]): SxColumn<GeoSubRegion>[] => [
  { key: "unitCode", header: "Code", render: (r) => <span className="font-data font-medium text-primary">{r.unitCode}</span> },
  { key: "name", header: "Sub-Region Name", render: (r) => <span className="font-medium">{r.name}</span> },
  {
    key: "regionId",
    header: "Parent Region",
    render: (r) => {
      const parent = regions.find((reg) => reg.id === r.regionId);
      return parent ? <SxStatusBadge variant="info">{parent.unitCode} — {parent.name}</SxStatusBadge> : <span className="text-xs text-muted-foreground italic">None</span>;
    },
  },
];

const cityColumns = (regions: GeoRegion[], subRegions: GeoSubRegion[]): SxColumn<GeoCity>[] => [
  { key: "unitCode", header: "Code", render: (r) => <span className="font-data font-medium text-primary">{r.unitCode}</span> },
  { key: "name", header: "City Name", render: (r) => <span className="font-medium">{r.name}</span> },
  {
    key: "regionId",
    header: "Region",
    render: (r) => {
      const parent = regions.find((reg) => reg.id === r.regionId);
      return parent ? parent.name : <span className="text-xs text-muted-foreground italic">—</span>;
    },
  },
  {
    key: "subRegionId",
    header: "Sub-Region",
    render: (r) => {
      const parent = subRegions.find((sr) => sr.id === r.subRegionId);
      return parent ? parent.name : <span className="text-xs text-muted-foreground italic">—</span>;
    },
  },
];

const zoneColumns = (cities: GeoCity[], subRegions: GeoSubRegion[], regions: GeoRegion[]): SxColumn<GeoZone>[] => [
  { key: "unitCode", header: "Code", render: (r) => <span className="font-data font-medium text-primary">{r.unitCode}</span> },
  { key: "name", header: "Zone Name", render: (r) => <span className="font-medium">{r.name}</span> },
  {
    key: "cityId",
    header: "City",
    render: (r) => {
      const parent = cities.find((c) => c.id === r.cityId);
      return parent ? <span>{parent.unitCode} — {parent.name}</span> : <span className="text-xs text-muted-foreground italic">—</span>;
    },
  },
  {
    key: "subRegionId" as keyof GeoZone,
    header: "Sub-Region",
    render: (r) => {
      const city = cities.find((c) => c.id === r.cityId);
      const sr = city?.subRegionId ? subRegions.find((s) => s.id === city.subRegionId) : null;
      return sr ? <span>{sr.unitCode} — {sr.name}</span> : <span className="text-xs text-muted-foreground italic">—</span>;
    },
  },
  {
    key: "regionId" as keyof GeoZone,
    header: "Region",
    render: (r) => {
      const city = cities.find((c) => c.id === r.cityId);
      const reg = city?.regionId ? regions.find((rg) => rg.id === city.regionId) : null;
      return reg ? <SxStatusBadge variant="info">{reg.unitCode} — {reg.name}</SxStatusBadge> : <span className="text-xs text-muted-foreground italic">—</span>;
    },
  },
];

/* ── Page component ────────────────────────────────────────── */

export default function GeoHierarchyPage() {
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  const [subRegions, setSubRegions] = useState<GeoSubRegion[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [zones, setZones] = useState<GeoZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogType, setDialogType] = useState<GeoType | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await api.get<{
      regions: GeoRegion[];
      subRegions: GeoSubRegion[];
      cities: GeoCity[];
      zones: GeoZone[];
    }>("/api/regions");
    if (result.ok) {
      setRegions(result.data.regions);
      setSubRegions(result.data.subRegions);
      setCities(result.data.cities);
      setZones(result.data.zones);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Forms ──────────────────────────────────────────────── */

  const regionForm = useForm<z.infer<typeof regionSchema>>({
    resolver: zodResolver(regionSchema),
    defaultValues: { name: "" },
  });

  const subRegionForm = useForm<z.infer<typeof subRegionSchema>>({
    resolver: zodResolver(subRegionSchema),
    defaultValues: { name: "", regionId: "" },
  });

  const cityForm = useForm<z.infer<typeof citySchema>>({
    resolver: zodResolver(citySchema),
    defaultValues: { name: "", regionId: "", subRegionId: "" },
  });

  const zoneForm = useForm<z.infer<typeof zoneSchema>>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { name: "", cityId: "" },
  });

  const handleCreate = async (type: GeoType, data: Record<string, unknown>) => {
    const result = await api.post<Record<string, unknown>>("/api/regions", {
      type,
      ...data,
    });
    if (result.ok) {
      toast.success(`${type === "subRegion" ? "Sub-region" : type.charAt(0).toUpperCase() + type.slice(1)} created`);
      setDialogType(null);
      regionForm.reset();
      subRegionForm.reset();
      cityForm.reset();
      zoneForm.reset();
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDialogType(null);
      regionForm.reset();
      subRegionForm.reset();
      cityForm.reset();
      zoneForm.reset();
    }
  };

  const tabCounts = {
    region: regions.length,
    subRegion: subRegions.length,
    city: cities.length,
    zone: zones.length,
  };

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Geographic Hierarchy"
        subtitle="Manage regions, sub-regions, cities, and zones for campus assignment"
      />

      <Tabs defaultValue="cities">
        <TabsList>
          <TabsTrigger value="regions" className="gap-1.5">
            <MapPin size={14} /> Regions ({tabCounts.region})
          </TabsTrigger>
          <TabsTrigger value="subRegions" className="gap-1.5">
            <Layers size={14} /> Sub-Regions ({tabCounts.subRegion})
          </TabsTrigger>
          <TabsTrigger value="cities" className="gap-1.5">
            <Building size={14} /> Cities ({tabCounts.city})
          </TabsTrigger>
          <TabsTrigger value="zones" className="gap-1.5">
            <Navigation size={14} /> Zones ({tabCounts.zone})
          </TabsTrigger>
        </TabsList>

        {/* ── Regions Tab ──────────────────────────────────── */}
        <TabsContent value="regions" className="space-y-4">
          <div className="flex justify-end">
            <SxButton sxVariant="primary" icon={<Plus size={16} />} onClick={() => setDialogType("region")}>
              Add Region
            </SxButton>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <SxDataTable
              columns={regionColumns}
              data={regions as unknown as Record<string, unknown>[]}
              loading={loading}
              emptyMessage="No regions defined yet."
            />
          </div>
        </TabsContent>

        {/* ── Sub-Regions Tab ──────────────────────────────── */}
        <TabsContent value="subRegions" className="space-y-4">
          <div className="flex justify-end">
            <SxButton sxVariant="primary" icon={<Plus size={16} />} onClick={() => setDialogType("subRegion")}>
              Add Sub-Region
            </SxButton>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <SxDataTable
              columns={subRegionColumns(regions) as unknown as SxColumn<Record<string, unknown>>[]}
              data={subRegions as unknown as Record<string, unknown>[]}
              loading={loading}
              emptyMessage="No sub-regions defined yet."
            />
          </div>
        </TabsContent>

        {/* ── Cities Tab ───────────────────────────────────── */}
        <TabsContent value="cities" className="space-y-4">
          <div className="flex justify-end">
            <SxButton sxVariant="primary" icon={<Plus size={16} />} onClick={() => setDialogType("city")}>
              Add City
            </SxButton>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <SxDataTable
              columns={cityColumns(regions, subRegions) as unknown as SxColumn<Record<string, unknown>>[]}
              data={cities as unknown as Record<string, unknown>[]}
              loading={loading}
              emptyMessage="No cities defined yet."
            />
          </div>
        </TabsContent>

        {/* ── Zones Tab ────────────────────────────────────── */}
        <TabsContent value="zones" className="space-y-4">
          <div className="flex justify-end">
            <SxButton sxVariant="primary" icon={<Plus size={16} />} onClick={() => setDialogType("zone")}>
              Add Zone
            </SxButton>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <SxDataTable
              columns={zoneColumns(cities, subRegions, regions) as unknown as SxColumn<Record<string, unknown>>[]}
              data={zones as unknown as Record<string, unknown>[]}
              loading={loading}
              emptyMessage="No zones defined yet."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create Region Dialog ─────────────────────────── */}
      <Dialog open={dialogType === "region"} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Region</DialogTitle>
            <DialogDescription>Top-level geographic area (e.g. Punjab, Sindh).</DialogDescription>
          </DialogHeader>
          <Form {...regionForm}>
            <form onSubmit={regionForm.handleSubmit((d) => handleCreate("region", d))} className="space-y-4">
              <FormField control={regionForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Region Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Punjab" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <SxButton type="button" sxVariant="outline" onClick={() => handleOpenChange(false)}>Cancel</SxButton>
                <SxButton type="submit" sxVariant="primary" loading={regionForm.formState.isSubmitting}>Create</SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Create Sub-Region Dialog ─────────────────────── */}
      <Dialog open={dialogType === "subRegion"} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sub-Region</DialogTitle>
            <DialogDescription>Optional layer under a region (e.g. South Punjab).</DialogDescription>
          </DialogHeader>
          <Form {...subRegionForm}>
            <form onSubmit={subRegionForm.handleSubmit((d) => handleCreate("subRegion", d))} className="space-y-4">
              <FormField control={subRegionForm.control} name="regionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Region (optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={subRegionForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Region Name</FormLabel>
                  <FormControl><Input placeholder="e.g. South Punjab" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <SxButton type="button" sxVariant="outline" onClick={() => handleOpenChange(false)}>Cancel</SxButton>
                <SxButton type="submit" sxVariant="primary" loading={subRegionForm.formState.isSubmitting}>Create</SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Create City Dialog ───────────────────────────── */}
      <Dialog open={dialogType === "city"} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add City</DialogTitle>
            <DialogDescription>Required for campus assignment.</DialogDescription>
          </DialogHeader>
          <Form {...cityForm}>
            <form onSubmit={cityForm.handleSubmit((d) => handleCreate("city", d))} className="space-y-4">
              <FormField control={cityForm.control} name="regionId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Region (optional)</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); cityForm.setValue("subRegionId", ""); }}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={cityForm.control} name="subRegionId" render={({ field }) => {
                const selectedRegionId = cityForm.watch("regionId");
                const filteredSubRegions = selectedRegionId && selectedRegionId !== "none"
                  ? subRegions.filter((sr) => sr.regionId === selectedRegionId)
                  : subRegions;
                return (
                <FormItem>
                  <FormLabel>Sub-Region (optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {filteredSubRegions.map((sr) => <SelectItem key={sr.id} value={sr.id}>{sr.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
                );
              }} />
              <FormField control={cityForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>City Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Lahore" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <SxButton type="button" sxVariant="outline" onClick={() => handleOpenChange(false)}>Cancel</SxButton>
                <SxButton type="submit" sxVariant="primary" loading={cityForm.formState.isSubmitting}>Create</SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Create Zone Dialog ───────────────────────────── */}
      <Dialog open={dialogType === "zone"} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Zone</DialogTitle>
            <DialogDescription>Optional subdivision within a city.</DialogDescription>
          </DialogHeader>
          <Form {...zoneForm}>
            <form onSubmit={zoneForm.handleSubmit((d) => handleCreate("zone", d))} className="space-y-4">
              <FormField control={zoneForm.control} name="cityId" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Select city" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={zoneForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Zone Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Zone 5 — Gulberg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <SxButton type="button" sxVariant="outline" onClick={() => handleOpenChange(false)}>Cancel</SxButton>
                <SxButton type="submit" sxVariant="primary" loading={zoneForm.formState.isSubmitting}>Create</SxButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
