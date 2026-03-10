"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  SxPageHeader,
  SxButton,
  SxDataTable,
  SxStatusBadge,
  SxFormSection,
  type SxColumn,
} from "@/components/sx";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendSingleSmsSchema,
  sendBulkSmsSchema,
  type SendSingleSmsInput,
  type SendBulkSmsInput,
} from "@/lib/validations/sms";

type CommunicationChannel = "SMS" | "EMAIL" | "WHATSAPP";

interface BulkSmsRecipient {
  name?: string;
  phone: string;
}

interface BulkSmsResponse {
  jobId: string;
  message: string;
}

interface ChannelJobRow {
  id: string;
  type: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD" | string;
  queue: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  user: { email: string } | null;
}

interface ChannelJobsResponse {
  jobs: ChannelJobRow[];
}

const channelColumns: SxColumn<ChannelJobRow>[] = [
  {
    key: "id",
    header: "Job ID",
    render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 12)}...</span>,
  },
  {
    key: "type",
    header: "Type",
    render: (row) => <span className="text-sm text-foreground">{row.type}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => {
      const variant =
        row.status === "COMPLETED"
          ? "success"
          : row.status === "FAILED" || row.status === "DEAD"
            ? "destructive"
            : row.status === "PROCESSING"
              ? "info"
              : "warning";
      return <SxStatusBadge variant={variant}>{row.status}</SxStatusBadge>;
    },
  },
  {
    key: "attempts",
    header: "Attempts",
    render: (row) => (
      <span className="text-sm text-foreground">
        {row.attempts}/{row.maxAttempts}
      </span>
    ),
  },
  {
    key: "queue",
    header: "Queue",
    render: (row) => <span className="text-sm text-muted-foreground">{row.queue}</span>,
  },
  {
    key: "user",
    header: "Triggered By",
    render: (row) => <span className="text-sm text-muted-foreground">{row.user?.email ?? "system"}</span>,
  },
  {
    key: "createdAt",
    header: "Created",
    render: (row) => <span className="text-sm text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</span>,
  },
];

function parseRecipients(text: string): BulkSmsRecipient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length >= 2) {
        return { name: parts[0], phone: parts[1] };
      }
      return { phone: parts[0] };
    })
    .filter((recipient) => recipient.phone.length >= 7);
}

export default function AdminCommunicationsPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [smsMode, setSmsMode] = useState<"single" | "bulk">("single");
  const [jobs, setJobs] = useState<ChannelJobRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const singleForm = useForm<SendSingleSmsInput>({
    resolver: zodResolver(sendSingleSmsSchema),
    defaultValues: { phone: "", message: "" },
  });

  const bulkForm = useForm<SendBulkSmsInput>({
    resolver: zodResolver(sendBulkSmsSchema),
    defaultValues: { recipientsText: "", message: "" },
  });

  const fetchChannelJobs = useCallback(async (nextChannel: CommunicationChannel) => {
    setRefreshing(true);
    const result = await api.get<ChannelJobsResponse>(`/api/jobs?type=${nextChannel}&page=1&limit=25`);
    if (result.ok) {
      setJobs(result.data.jobs);
    } else {
      toast.error(result.error);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchChannelJobs(channel);
  }, [channel, fetchChannelJobs]);

  const sendSingleSms = async (values: SendSingleSmsInput) => {
    const result = await api.post<BulkSmsResponse>("/api/jobs/bulk-sms", {
      message: values.message,
      recipients: [{ phone: values.phone }],
    });

    if (result.ok) {
      toast.success("SMS queued successfully");
      singleForm.reset();
      void fetchChannelJobs("SMS");
    } else if (result.fieldErrors) {
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const sendBulkSms = async (values: SendBulkSmsInput) => {
    const recipients = parseRecipients(values.recipientsText);
    if (recipients.length === 0) {
      bulkForm.setError("recipientsText", { message: "No valid recipients found" });
      toast.error("Add at least one valid recipient");
      return;
    }

    const result = await api.post<BulkSmsResponse>("/api/jobs/bulk-sms", {
      message: values.message,
      recipients,
    });

    if (result.ok) {
      toast.success(`Bulk SMS queued for ${recipients.length} recipients`);
      bulkForm.reset();
      void fetchChannelJobs("SMS");
    } else if (result.fieldErrors) {
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const queuedCount = useMemo(
    () => jobs.filter((job) => job.status === "PENDING" || job.status === "PROCESSING").length,
    [jobs],
  );
  const completedCount = useMemo(() => jobs.filter((job) => job.status === "COMPLETED").length, [jobs]);
  const failedCount = useMemo(
    () => jobs.filter((job) => job.status === "FAILED" || job.status === "DEAD").length,
    [jobs],
  );

  return (
    <div className="space-y-6">
      <SxPageHeader
        title="Communications"
        subtitle="Manage SMS, Email, and WhatsApp operations from one place."
        actions={
          <SxButton
            sxVariant="outline"
            icon={<RefreshCw size={16} />}
            onClick={() => void fetchChannelJobs(channel)}
            loading={refreshing}
          >
            Refresh
          </SxButton>
        }
      />

      <Tabs value={channel} onValueChange={(value) => setChannel(value as CommunicationChannel)}>
        <TabsList>
          <TabsTrigger value="SMS">SMS</TabsTrigger>
          <TabsTrigger value="EMAIL">Email</TabsTrigger>
          <TabsTrigger value="WHATSAPP">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="SMS" className="mt-4 space-y-4">
          <Tabs value={smsMode} onValueChange={(value) => setSmsMode(value as "single" | "bulk")}>
            <TabsList>
              <TabsTrigger value="single">Single SMS</TabsTrigger>
              <TabsTrigger value="bulk">Bulk SMS</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(sendSingleSms)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={2}>
                    <FormField
                      control={singleForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="03001234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div />
                  </SxFormSection>

                  <SxFormSection columns={1}>
                    <FormField
                      control={singleForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Write SMS message..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>

                  <div className="mt-4">
                    <SxButton
                      type="submit"
                      sxVariant="primary"
                      icon={<Send size={16} />}
                      loading={singleForm.formState.isSubmitting}
                    >
                      Send SMS
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4">
              <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(sendBulkSms)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={1}>
                    <FormField
                      control={bulkForm.control}
                      name="recipientsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipients</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={6}
                              placeholder={"One per line: phone or name,phone\nAli,03001234567\n03007654321"}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>

                  <SxFormSection columns={1}>
                    <FormField
                      control={bulkForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Use {name} for personalization" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>

                  <div className="mt-4">
                    <SxButton
                      type="submit"
                      sxVariant="primary"
                      icon={<Send size={16} />}
                      loading={bulkForm.formState.isSubmitting}
                    >
                      Queue Bulk SMS
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="EMAIL" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-foreground">
              Email delivery is active through queued jobs. Use reminders and automated workflows for now.
            </p>
            <SxButton sxVariant="outline" onClick={() => router.push("/admin/reminders")}>
              Open Reminders
            </SxButton>
          </div>
        </TabsContent>

        <TabsContent value="WHATSAPP" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-foreground">
              WhatsApp pipeline is available in queue workers. UI sending controls can be added next.
            </p>
            <SxButton sxVariant="outline" onClick={() => router.push("/admin/jobs")}>
              Open Job Monitor
            </SxButton>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Queued</p>
          <p className="text-lg font-semibold text-warning">{queuedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-semibold text-success">{completedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-lg font-semibold text-destructive">{failedCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <SxDataTable
          columns={channelColumns}
          data={jobs}
          rowKey={(row) => row.id}
          emptyMessage={`No ${channel.toLowerCase()} jobs yet.`}
        />
      </div>
    </div>
  );
}

