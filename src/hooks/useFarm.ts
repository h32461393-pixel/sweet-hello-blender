import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getHomeState,
  syncUser,
  startMining,
  claimMining,
  claimDaily,
  claimRewardCode,
  claimChannelTask,
} from "@/lib/farm.functions";
import { getInitData } from "@/lib/telegram-client";

export const HOME_KEY = ["home-state"];

export function useSyncUser() {
  const fn = useServerFn(syncUser);
  return useMutation({ mutationFn: () => fn({ data: { initData: getInitData() } }) });
}

/** Live home state — refreshed every 15s and after every action. */
export function useHomeState(enabled = true) {
  const fn = useServerFn(getHomeState);
  return useQuery({
    queryKey: HOME_KEY,
    queryFn: () => fn({ data: { initData: getInitData() } }),
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

function useFarmAction<TArgs, TResult>(fn: (args: { data: TArgs }) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Omit<TArgs, "initData">) =>
      fn({ data: { ...(args as object), initData: getInitData() } as TArgs }),
    onSettled: () => qc.invalidateQueries({ queryKey: HOME_KEY }),
  });
}

export function useStartMining() {
  return useFarmAction(useServerFn(startMining));
}
export function useClaimMining() {
  return useFarmAction(useServerFn(claimMining));
}
export function useClaimDaily() {
  return useFarmAction(useServerFn(claimDaily));
}
export function useClaimRewardCode() {
  return useFarmAction(useServerFn(claimRewardCode));
}
export function useClaimChannelTask() {
  return useFarmAction(useServerFn(claimChannelTask));
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg.includes("SUSPENDED")) return "Your account is suspended.";
  if (msg.includes("NOT_JOINED")) return "Please join the channel first, then try again.";
  if (!msg || msg.includes("fetch") || msg.includes("Failed")) return "Network error. Please try again.";
  return msg;
}
