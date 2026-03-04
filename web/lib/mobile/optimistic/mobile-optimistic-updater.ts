import type { QueryClient } from "@tanstack/react-query";

type MobileKpi = {
  id: string;
  value: number | string;
};

type MobileAlert = {
  id: string;
  count?: number;
  value?: number | string;
};

type MobileTodayItem = {
  id: string;
  value: number | string;
};

type MobileDashboardSnapshot = {
  kpis?: MobileKpi[];
  todayFocus?: MobileTodayItem[];
  alerts?: MobileAlert[] | Record<string, number>;
};

type CollectFeePayload = {
  amount: number;
  reduceDefaulterCountBy?: number;
};

type MarkAttendancePayload = {
  classId: string;
};

type IssueChallanPayload = {
  mode: "single" | "class";
  estimatedAmount?: number;
  generatedEstimate?: number;
};

function parseNumeric(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }

  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function optimisticUpdate(
  type: string,
  payload: unknown,
  queryClient: QueryClient,
) {
  if (type === "MARK_ATTENDANCE") {
    const markPayload = payload as MarkAttendancePayload;
    if (!markPayload.classId) {
      return;
    }

    queryClient.setQueryData<MobileDashboardSnapshot | undefined>(
      ["mobile-dashboard"],
      (old) => {
        if (!old) {
          return old;
        }

        const nextTodayFocus = old.todayFocus?.map((item) => {
          if (
            item.id === "ATTENDANCE_MARKED_CLASSES" ||
            item.id === "ATTENDANCE_MARKED_TODAY"
          ) {
            return { ...item, value: parseNumeric(item.value) + 1 };
          }
          return item;
        });

        let nextAlerts: MobileDashboardSnapshot["alerts"] = old.alerts;
        if (Array.isArray(old.alerts)) {
          nextAlerts = old.alerts.map((alert) => {
            if (
              alert.id === "ATTENDANCE_NOT_MARKED_ALERT" ||
              alert.id === "ATTENDANCE_UNMARKED_CLASSES"
            ) {
              const currentCount =
                alert.count != null
                  ? alert.count
                  : alert.value != null
                    ? parseNumeric(alert.value)
                    : 0;
              return {
                ...alert,
                count: Math.max(currentCount - 1, 0),
                value: Math.max(currentCount - 1, 0),
              };
            }
            return alert;
          });
        } else if (old.alerts && typeof old.alerts === "object") {
          const currentUnmarked = Number(
            old.alerts.unmarkedClassesCount ??
              old.alerts.unmarkedStudentAttendance ??
              0,
          );
          nextAlerts = {
            ...old.alerts,
            unmarkedClassesCount: Math.max(currentUnmarked - 1, 0),
          };
        }

        return {
          ...old,
          todayFocus: nextTodayFocus,
          alerts: nextAlerts,
        };
      },
    );
    return;
  }

  if (type === "ADD_STUDENT_QUICK") {
    queryClient.setQueryData<MobileDashboardSnapshot | undefined>(
      ["mobile-dashboard"],
      (old) => {
        if (!old) {
          return old;
        }

        const nextKpis = old.kpis?.map((kpi) => {
          if (kpi.id === "TOTAL_STUDENTS") {
            return { ...kpi, value: parseNumeric(kpi.value) + 1 };
          }
          return kpi;
        });

        const nextTodayFocus = old.todayFocus?.map((item) => {
          if (item.id === "NEW_ADMISSIONS_TODAY") {
            return { ...item, value: parseNumeric(item.value) + 1 };
          }
          return item;
        });

        return {
          ...old,
          kpis: nextKpis,
          todayFocus: nextTodayFocus,
        };
      },
    );
    return;
  }

  if (type === "ISSUE_CHALLAN") {
    const challanPayload = payload as IssueChallanPayload;
    const pendingReceivableIncrement = Number(challanPayload.estimatedAmount ?? 0);
    const generatedEstimate = Math.max(
      Number(challanPayload.generatedEstimate ?? 1),
      1,
    );

    queryClient.setQueryData<MobileDashboardSnapshot | undefined>(
      ["mobile-dashboard"],
      (old) => {
        if (!old) {
          return old;
        }

        const nextKpis = old.kpis?.map((kpi) => {
          if (kpi.id === "PENDING_RECEIVABLES") {
            return {
              ...kpi,
              value: Math.max(
                parseNumeric(kpi.value) + Math.max(pendingReceivableIncrement, 0),
                0,
              ),
            };
          }
          return kpi;
        });

        const nextTodayFocus = old.todayFocus?.map((item) => {
          if (item.id === "CHALLANS_ISSUED_TODAY") {
            return { ...item, value: parseNumeric(item.value) + generatedEstimate };
          }
          return item;
        });

        let nextAlerts: MobileDashboardSnapshot["alerts"] = old.alerts;
        if (Array.isArray(old.alerts)) {
          nextAlerts = old.alerts.map((alert) => {
            if (alert.id === "CHALLAN_NOT_GENERATED_ALERT") {
              const currentCount =
                alert.count != null
                  ? alert.count
                  : alert.value != null
                    ? parseNumeric(alert.value)
                    : 0;
              return {
                ...alert,
                count: Math.max(currentCount - 1, 0),
                value: Math.max(currentCount - 1, 0),
              };
            }
            return alert;
          });
        } else if (old.alerts && typeof old.alerts === "object") {
          const currentCount = Number(old.alerts.challanGenerationCount ?? 0);
          nextAlerts = {
            ...old.alerts,
            challanGenerationCount: Math.max(currentCount - 1, 0),
          };
        }

        return {
          ...old,
          kpis: nextKpis,
          todayFocus: nextTodayFocus,
          alerts: nextAlerts,
        };
      },
    );
    return;
  }

  if (type !== "COLLECT_FEE") {
    return;
  }

  const collectFeePayload = payload as CollectFeePayload;
  const incrementBy = Number(collectFeePayload.amount ?? 0);
  const reduceDefaulterBy = Math.max(
    Number(collectFeePayload.reduceDefaulterCountBy ?? 0),
    0,
  );
  if (!Number.isFinite(incrementBy) || incrementBy <= 0) {
    return;
  }

  queryClient.setQueryData<MobileDashboardSnapshot | undefined>(
    ["mobile-dashboard"],
    (old) => {
      if (!old?.kpis?.length) {
        if (!old) {
          return old;
        }
      }

      const nextKpis = old?.kpis?.map((kpi) => {
        if (kpi.id === "TODAY_COLLECTION") {
          return { ...kpi, value: parseNumeric(kpi.value) + incrementBy };
        }
        if (reduceDefaulterBy > 0 && kpi.id === "DEFAULTERS_COUNT") {
          return {
            ...kpi,
            value: Math.max(parseNumeric(kpi.value) - reduceDefaulterBy, 0),
          };
        }
        return kpi;
      });

      const nextTodayFocus = old?.todayFocus?.map((item) =>
        item.id === "TODAY_COLLECTION"
          ? { ...item, value: parseNumeric(item.value) + incrementBy }
          : item,
      );

      let nextAlerts: MobileDashboardSnapshot["alerts"] = old?.alerts;
      if (Array.isArray(old?.alerts)) {
        nextAlerts = old.alerts
          .map((alert) => {
            if (
              reduceDefaulterBy > 0 &&
              (alert.id === "FEE_DEFAULTERS_ALERT" ||
                alert.id === "DEFAULTERS_COUNT")
            ) {
              const count =
                alert.count != null
                  ? Math.max(alert.count - reduceDefaulterBy, 0)
                  : undefined;
              const value =
                alert.value != null
                  ? Math.max(parseNumeric(alert.value) - reduceDefaulterBy, 0)
                  : undefined;
              return { ...alert, count, value };
            }
            if (alert.id === "FEE_OVERDUE_FOR_SELECTED_STUDENT") {
              return { ...alert, count: 0, value: 0 };
            }
            return alert;
          })
          .filter((alert) => {
            if (alert.id !== "FEE_OVERDUE_FOR_SELECTED_STUDENT") {
              return true;
            }
            const countValue =
              alert.count != null
                ? alert.count
                : alert.value != null
                  ? parseNumeric(alert.value)
                  : 0;
            return countValue > 0;
          });
      } else if (old?.alerts && typeof old.alerts === "object") {
        const currentDefaulters = Number(old.alerts.feeDefaultersToday ?? 0);
        nextAlerts = {
          ...old.alerts,
          feeDefaultersToday:
            reduceDefaulterBy > 0
              ? Math.max(currentDefaulters - reduceDefaulterBy, 0)
              : currentDefaulters,
          feeOverdueForSelectedStudent: 0,
        };
      }

      return {
        ...old,
        kpis: nextKpis,
        todayFocus: nextTodayFocus,
        alerts: nextAlerts,
      };
    },
  );
}
