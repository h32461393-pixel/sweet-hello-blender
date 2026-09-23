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
  getAdsState,
  claimAdView,
  getProfileState,
  setWallet,
  getWithdrawState,
  createWithdrawal,
  getTasks,
  claimTask,
  claimReferralRewards,
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

export function useAdsState(enabled = true) {
  const fn = useServerFn(getAdsState);
  return useQuery({
    queryKey: ["ads-state"],
    queryFn: () => fn({ data: { initData: getInitData() } }),
    enabled,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useClaimAdView() {
  const qc = useQueryClient();
  const fn = useServerFn(claimAdView);
  return useMutation({
    mutationFn: (args: {
      source: "adsgram" | "adsgram_int" | "monetag" | "gigapub" | "site";
    }) =>
      fn({ data: { ...args, initData: getInitData() } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: HOME_KEY });
      qc.invalidateQueries({ queryKey: ["ads-state"] });
    },
  });
}

export const PROFILE_KEY = ["profile-state"];

export function useProfileState(enabled = true) {
  const fn = useServerFn(getProfileState);
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => fn({ data: { initData: getInitData() } }),
    enabled,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useSetWallet() {
  const qc = useQueryClient();
  const fn = useServerFn(setWallet);
  return useMutation({
    mutationFn: (address: string) => fn({ data: { initData: getInitData(), address } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: HOME_KEY });
    },
  });
}

export function useClaimReferralRewards() {
  const qc = useQueryClient();
  const fn = useServerFn(claimReferralRewards);
  return useMutation({
    mutationFn: () => fn({ data: { initData: getInitData() } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: HOME_KEY });
    },
  });
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg.includes("SUSPENDED")) return "Your account is suspended.";
  if (msg.includes("NOT_JOINED")) return "Please join the channel first, then try again.";
  if (!msg || msg.includes("fetch") || msg.includes("Failed")) return "Network error. Please try again.";
  return msg;
}

export const WITHDRAW_KEY = ["withdraw-state"];

export function useWithdrawState(enabled = true) {
  const fn = useServerFn(getWithdrawState);
  return useQuery({
    queryKey: WITHDRAW_KEY,
    queryFn: () => fn({ data: { initData: getInitData() } }),
    enabled,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useCreateWithdrawal() {
  const qc = useQueryClient();
  const fn = useServerFn(createWithdrawal);
  return useMutation({
    mutationFn: (tokens: number) => fn({ data: { initData: getInitData(), tokens } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: WITHDRAW_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: HOME_KEY });
    },
  });
}

export const TASKS_KEY = ["tasks-state"];

export function useTasks(enabled = true) {
  const fn = useServerFn(getTasks);
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => fn({ data: { initData: getInitData() } }),
    enabled,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useClaimTask() {
  const qc = useQueryClient();
  const fn = useServerFn(claimTask);
  return useMutation({
    mutationFn: (taskId: string) => fn({ data: { initData: getInitData(), taskId } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      qc.invalidateQueries({ queryKey: HOME_KEY });
    },
  });
}
