import { createServerFn } from "@tanstack/react-start";

import {
  fetchHomeFeed,
  fetchJobDetail,
  fetchJobs,
  fetchWorkerDetail,
  fetchWorkerReviews,
  fetchWorkers,
} from "./public-data.server";

export const getHomeFeed = createServerFn({ method: "GET" }).handler(async () => fetchHomeFeed());

export const getJobs = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { q?: string; category?: string; area?: string; limit?: number; offset?: number }) =>
      input ?? {},
  )
  .handler(async ({ data }) => fetchJobs(data));

export const getWorkers = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { q?: string; category?: string; limit?: number; offset?: number }) => input ?? {},
  )
  .handler(async ({ data }) => fetchWorkers(data));

export const getJobDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => fetchJobDetail(data.id));

export const getWorkerDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => fetchWorkerDetail(data.id));

export const getWorkerReviews = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string; offset: number }) => input)
  .handler(async ({ data }) => fetchWorkerReviews(data.id, data.offset));
