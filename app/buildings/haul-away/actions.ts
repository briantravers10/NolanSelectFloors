"use server";

import { getDrivingRoute, isLiveRoutingConfigured, type Stop } from "@/lib/routing";

export async function computeLiveRouteAction(stops: Stop[]) {
  const route = await getDrivingRoute(stops);
  return { route, liveConfigured: isLiveRoutingConfigured() };
}
