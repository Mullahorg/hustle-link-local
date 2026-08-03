import { queryOptions } from "@tanstack/react-query";

import { getHomeFeed, getJobDetail, getJobs, getWorkerDetail, getWorkers } from "./catalog.functions";

export const homeFeedQuery = () =>
  queryOptions({
    queryKey: ["home-feed"],
    queryFn: () => getHomeFeed(),
    staleTime: 30_000,
  });

export const jobsQuery = (args: { q?: string; category?: string }) =>
  queryOptions({
    queryKey: ["jobs", args.q ?? "", args.category ?? ""],
    queryFn: () => getJobs({ data: args }),
    staleTime: 15_000,
  });

export const workersQuery = (args: { q?: string; category?: string }) =>
  queryOptions({
    queryKey: ["workers", args.q ?? "", args.category ?? ""],
    queryFn: () => getWorkers({ data: args }),
    staleTime: 15_000,
  });

export const jobDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["job", id],
    queryFn: () => getJobDetail({ data: { id } }),
    staleTime: 10_000,
  });

export const workerDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["worker", id],
    queryFn: () => getWorkerDetail({ data: { id } }),
    staleTime: 10_000,
  });
