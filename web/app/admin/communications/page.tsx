"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  sendBulkEmailSchema,
  sendWhatsAppBulkSchema,
  sendWhatsAppSingleSchema,
  type SendBulkEmailInput,
  type SendWhatsAppBulkInput,
  type SendWhatsAppSingleInput,
} from "@/lib/validations/communications";

type CommunicationChannel = "SMS" | "EMAIL" | "WHATSAPP";

interface BulkSmsRecipient {
  name?: string;
  phone: string;
}

interface BulkSmsResponse {
  jobIds?: string[];
  jobId?: string;
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

interface BulkEmailRecipient {
  name?: string;
  email: string;
}

function parseEmailRecipients(text: string): BulkEmailRecipient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length >= 2) {
        return { name: parts[0], email: parts[1] };
      }
      return { email: parts[0] };
    })
    .filter((recipient) => recipient.email.includes("@"));
}

export default function AdminCommunicationsPage() {
  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [smsMode, setSmsMode] = useState<"single" | "bulk">("single");
  const [emailMode, setEmailMode] = useState<"single" | "bulk">("single");
  const [whatsAppMode, setWhatsAppMode] = useState<"single" | "bulk">("single");
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

  const emailForm = useForm<SendBulkEmailInput>({
    resolver: zodResolver(sendBulkEmailSchema),
    defaultValues: { recipientsText: "", subject: "", message: "" },
  });

  const whatsAppSingleForm = useForm<SendWhatsAppSingleInput>({
    resolver: zodResolver(sendWhatsAppSingleSchema),
    defaultValues: { phone: "", message: "" },
  });

  const whatsAppBulkForm = useForm<SendWhatsAppBulkInput>({
    resolver: zodResolver(sendWhatsAppBulkSchema),
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
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === "phone" || field === "message") {
          singleForm.setError(field, { message: messages[0] });
        }
      }
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
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === "recipientsText" || field === "message") {
          bulkForm.setError(field, { message: messages[0] });
        }
      }
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const sendEmail = async (values: SendBulkEmailInput) => {
    const recipients = parseEmailRecipients(values.recipientsText);
    if (recipients.length === 0) {
      emailForm.setError("recipientsText", { message: "No valid recipients found" });
      toast.error("Add at least one valid email recipient");
      return;
    }

    const result = await api.post<BulkSmsResponse>("/api/jobs/bulk-email", {
      subject: values.subject,
      message: values.message,
      recipients: emailMode === "single" ? [recipients[0]] : recipients,
    });

    if (result.ok) {
      const count = emailMode === "single" ? 1 : recipients.length;
      toast.success(`Email queued for ${count} recipient${count > 1 ? "s" : ""}`);
      emailForm.reset();
      void fetchChannelJobs("EMAIL");
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === "recipientsText" || field === "subject" || field === "message") {
          emailForm.setError(field, { message: messages[0] });
        }
      }
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const sendWhatsAppSingle = async (values: SendWhatsAppSingleInput) => {
    const result = await api.post<BulkSmsResponse>("/api/jobs/bulk-whatsapp", {
      message: values.message,
      recipients: [{ phone: values.phone }],
    });

    if (result.ok) {
      toast.success("WhatsApp message queued successfully");
      whatsAppSingleForm.reset();
      void fetchChannelJobs("WHATSAPP");
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === "phone" || field === "message") {
          whatsAppSingleForm.setError(field, { message: messages[0] });
        }
      }
      toast.error("Please fix the validation errors");
    } else {
      toast.error(result.error);
    }
  };

  const sendWhatsAppBulk = async (values: SendWhatsAppBulkInput) => {
    const recipients = parseRecipients(values.recipientsText);
    if (recipients.length === 0) {
      whatsAppBulkForm.setError("recipientsText", { message: "No valid recipients found" });
      toast.error("Add at least one valid recipient");
      return;
    }

    const result = await api.post<BulkSmsResponse>("/api/jobs/bulk-whatsapp", {
      message: values.message,
      recipients,
    });

    if (result.ok) {
      toast.success(`WhatsApp queued for ${recipients.length} recipients`);
      whatsAppBulkForm.reset();
      void fetchChannelJobs("WHATSAPP");
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === "recipientsText" || field === "message") {
          whatsAppBulkForm.setError(field, { message: messages[0] });
        }
      }
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
          <Tabs value={emailMode} onValueChange={(value) => setEmailMode(value as "single" | "bulk")}>
            <TabsList>
              <TabsTrigger value="single">Single Email</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Email</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(sendEmail)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={1}>
                    <FormField
                      control={emailForm.control}
                      name="recipientsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <SxFormSection columns={1}>
                    <FormField
                      control={emailForm.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Subject line" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <SxFormSection columns={1}>
                    <FormField
                      control={emailForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={5} placeholder="Write email message..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <div className="mt-4">
                    <SxButton type="submit" sxVariant="primary" icon={<Send size={16} />} loading={emailForm.formState.isSubmitting}>
                      Send Email
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(sendEmail)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={1}>
                    <FormField
                      control={emailForm.control}
                      name="recipientsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipients</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={6}
                              placeholder={"One per line: email or name,email\nali@example.com\nAli,ali@example.com"}
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
                      control={emailForm.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Subject line" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <SxFormSection columns={1}>
                    <FormField
                      control={emailForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={5} placeholder="Write email message..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <div className="mt-4">
                    <SxButton type="submit" sxVariant="primary" icon={<Send size={16} />} loading={emailForm.formState.isSubmitting}>
                      Queue Bulk Email
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="WHATSAPP" className="mt-4">
          <Tabs value={whatsAppMode} onValueChange={(value) => setWhatsAppMode(value as "single" | "bulk")}>
            <TabsList>
              <TabsTrigger value="single">Single WhatsApp</TabsTrigger>
              <TabsTrigger value="bulk">Bulk WhatsApp</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <Form {...whatsAppSingleForm}>
                <form onSubmit={whatsAppSingleForm.handleSubmit(sendWhatsAppSingle)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={2}>
                    <FormField
                      control={whatsAppSingleForm.control}
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
                      control={whatsAppSingleForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Write WhatsApp message..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </SxFormSection>
                  <div className="mt-4">
                    <SxButton type="submit" sxVariant="primary" icon={<Send size={16} />} loading={whatsAppSingleForm.formState.isSubmitting}>
                      Send WhatsApp
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4">
              <Form {...whatsAppBulkForm}>
                <form onSubmit={whatsAppBulkForm.handleSubmit(sendWhatsAppBulk)} className="rounded-lg border border-border bg-card p-4">
                  <SxFormSection columns={1}>
                    <FormField
                      control={whatsAppBulkForm.control}
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
                      control={whatsAppBulkForm.control}
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
                    <SxButton type="submit" sxVariant="primary" icon={<Send size={16} />} loading={whatsAppBulkForm.formState.isSubmitting}>
                      Queue Bulk WhatsApp
                    </SxButton>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
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

