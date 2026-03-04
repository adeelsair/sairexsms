import { MobileRoute } from "./mobile-routes";

export const mobileRouteMap: Record<MobileRoute, string> = {
  [MobileRoute.COLLECT_FEE]: "/mobile/fee/collect",
  [MobileRoute.MARK_ATTENDANCE]: "/mobile/attendance/mark",
  [MobileRoute.ADD_STUDENT]: "/mobile/students/add",
  [MobileRoute.ISSUE_CHALLAN]: "/mobile/challan/create",
  [MobileRoute.VIEW_DEFAULTERS]: "/mobile/defaulters",
};

export function resolveMobileRoute(route: MobileRoute): string {
  return mobileRouteMap[route];
}
