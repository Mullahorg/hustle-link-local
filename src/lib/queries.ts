import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  getHomeFeed,
  getJobDetail,
  getJobs,
  getWorkerDetail,
  getWorkerReviews,
  getWorkers,
} from "./catalog.functions";

/** One page size for every catalog list, so paging feels identical everywhere. */
export const CATALOG_PAGE = 20;
export const REVIEW_PAGE = 5;

export const homeFeedQuery = () =>
  queryOptions({
    queryKey: ["home-feed"],
    queryFn: () => getHomeFeed(),
    staleTime: 60_000,
  });

export const jobsQuery = (args: { q?: string; category?: string }) =>
  infiniteQueryOptions({
    queryKey: ["jobs", args.q ?? "", args.category ?? ""],
    queryFn: ({ pageParam }) =>
      getJobs({ data: { ...args, limit: CATALOG_PAGE, offset: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < CATALOG_PAGE ? undefined : allPages.length * CATALOG_PAGE,
    staleTime: 30_000,
  });

export const workersQuery = (args: { q?: string; category?: string }) =>
  infiniteQueryOptions({
    queryKey: ["workers", args.q ?? "", args.category ?? ""],
    queryFn: ({ pageParam }) =>
      getWorkers({ data: { ...args, limit: CATALOG_PAGE, offset: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < CATALOG_PAGE ? undefined : allPages.length * CATALOG_PAGE,
    staleTime: 30_000,
  });

export const jobDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["job", id],
    queryFn: () => getJobDetail({ data: { id } }),
    staleTime: 15_000,
  });

export const workerDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["worker", id],
    queryFn: () => getWorkerDetail({ data: { id } }),
    staleTime: 15_000,
  });

/** Reviews beyond the first page that ships with the profile. */
export const workerReviewsQuery = (id: string) =>
  infiniteQueryOptions({
    queryKey: ["worker-reviews", id],
    queryFn: ({ pageParam }) => getWorkerReviews({ data: { id, offset: pageParam } }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < REVIEW_PAGE ? undefined : allPages.length * REVIEW_PAGE,
    staleTime: 30_000,
  });
