import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { Avatar, Chip, EmptyState } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  addTeamMember,
  BUSINESS_ROLES,
  businessTeamQuery,
  createBusiness,
  myBusinessesQuery,
  removeTeamMember,
  roleLabel,
  setTeamRole,
  updateBusiness,
  type Business,
  type BusinessRole,
} from "@/lib/business";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "My business | HustlerLink" },
      {
        name: "description",
        content:
          "Register your shop, garage or salon on HustlerLink and give each person on your team the right job.",
      },
      { property: "og:title", content: "My business | HustlerLink" },
      {
        property: "og:description",
        content: "Run your shop with a team: managers, finance, staff, drivers and support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessScreen,
});

function BusinessScreen() {
  return (
    <AppShell>
      <ScreenHeader title="My business" subtitle="Your shop page and the people who run it." />
      <AuthGate
        title="Sign in to set up your business"
        body="A business page needs an account so only your team can change it."
      >
        <BusinessBody />
      </AuthGate>
    </AppShell>
  );
}

function BusinessBody() {
  const { user } = useAuth();
  const mine = useQuery(myBusinessesQuery(user?.id));
  const [creating, setCreating] = useState(false);

  if (mine.isPending) {
    return <p className="px-5 text-base font-semibold text-muted-foreground">Loading…</p>;
  }

  const businesses = mine.data ?? [];

  if (!businesses.length || creating) {
    return <CreateForm onDone={() => setCreating(false)} showCancel={businesses.length > 0} />;
  }

  return (
    <div className="space-y-6 px-5 pb-8">
      {businesses.map((business) => (
        <BusinessCard key={business.id} business={business} isOwner={business.owner_id === user?.id} />
      ))}
      <Button block variant="outline" onClick={() => setCreating(true)}>
        <Plus aria-hidden="true" /> Add another business
      </Button>
    </div>
  );
}

function CreateForm({ onDone, showCancel }: { onDone: () => void; showCancel: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [about, setAbout] = useState("");
  const [registration, setRegistration] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createBusiness({
        ownerId: user!.id,
        name: name.trim(),
        about: about.trim(),
        area: area.trim(),
        phone: phone.trim(),
        category_slug: null,
        registration_no: registration.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-businesses"] });
      toast.success("Your business page is ready");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-4 px-5 pb-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim().length < 2) return toast.error("Give your business a name");
        if (!area.trim()) return toast.error("Say where people can find you");
        create.mutate();
      }}
    >
      <EmptyState
        icon={<Building2 className="size-7" aria-hidden="true" />}
        title="Set up your business"
        body="A shop page lets customers find you, see what you sell and call you."
      />
      <div>
        <Label htmlFor="b-name">Business name</Label>
        <Input
          id="b-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mama Njeri Grocers"
        />
      </div>
      <div>
        <Label htmlFor="b-area">Where you are</Label>
        <Input
          id="b-area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Ruaka, near the stage"
        />
      </div>
      <div>
        <Label htmlFor="b-phone">Phone for customers</Label>
        <Input
          id="b-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="07xx xxx xxx"
        />
      </div>
      <div>
        <Label htmlFor="b-about">What you do</Label>
        <Textarea
          id="b-about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Fresh produce every morning, delivery around Ruaka."
          className="min-h-24"
        />
      </div>
      <div>
        <Label htmlFor="b-reg">Business number, if you have one</Label>
        <Input
          id="b-reg"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <Button type="submit" block size="lg" disabled={create.isPending}>
        {create.isPending ? "Saving…" : "Create my business page"}
      </Button>
      {showCancel ? (
        <Button type="button" block variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}

function BusinessCard({ business, isOwner }: { business: Business; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const team = useQuery(businessTeamQuery(business.id));
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<BusinessRole>("staff");
  const [about, setAbout] = useState(business.about ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["business-team"] });

  const add = useMutation({
    mutationFn: () => addTeamMember(business.id, phone, role),
    onSuccess: async (fullName) => {
      setPhone("");
      await invalidate();
      toast.success(`${fullName ?? "They"} joined your team`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: (input: { id: string; role: BusinessRole }) => setTeamRole(input.id, input.role),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeTeamMember(id),
    onSuccess: async () => {
      await invalidate();
      toast.success("Removed from the team");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveAbout = useMutation({
    mutationFn: () => updateBusiness(business.id, { about }),
    onSuccess: () => toast.success("Saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">{business.name}</h2>
        {business.verified ? <Chip tone="primary">Checked</Chip> : <Chip tone="muted">New</Chip>}
      </div>
      <p className="mt-1 text-base font-medium text-muted-foreground">
        {business.area || "No place set"}
      </p>
      <Link
        to="/businesses/$slug"
        params={{ slug: business.slug }}
        className="tap mt-2 inline-flex text-base font-bold text-primary-ink"
      >
        See the page customers see
      </Link>

      {isOwner ? (
        <div className="mt-4 space-y-2 border-t-2 border-border pt-4">
          <Label htmlFor={`about-${business.id}`}>What you do</Label>
          <Textarea
            id={`about-${business.id}`}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            className="min-h-20"
          />
          <Button
            variant="outline"
            disabled={saveAbout.isPending}
            onClick={() => saveAbout.mutate()}
          >
            Save
          </Button>
        </div>
      ) : null}

      <div className="mt-4 border-t-2 border-border pt-4">
        <h3 className="text-base font-extrabold">Your team</h3>
        <ul className="mt-2 space-y-2">
          {(team.data ?? []).map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-border p-3"
            >
              <Avatar name={member.full_name} url={member.avatar_url} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold">
                  {member.full_name ?? "Team member"}
                </span>
                <span className="block text-[0.9375rem] font-semibold text-muted-foreground">
                  {roleLabel(member.role)}
                </span>
              </span>
              {isOwner && member.user_id !== business.owner_id ? (
                <>
                  <select
                    aria-label={`Job for ${member.full_name ?? "team member"}`}
                    value={member.role}
                    onChange={(e) =>
                      changeRole.mutate({ id: member.id, role: e.target.value as BusinessRole })
                    }
                    className="min-h-12 rounded-xl border-2 border-border bg-card px-2 text-[0.9375rem] font-bold"
                  >
                    {BUSINESS_ROLES.filter((r) => r.role !== "owner").map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${member.full_name ?? "team member"}`}
                    onClick={() => remove.mutate(member.id)}
                    className="tap grid size-12 place-items-center rounded-xl text-destructive"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <div className="mt-3 space-y-2">
            <Label htmlFor={`add-${business.id}`}>Add someone by their phone number</Label>
            <div className="flex gap-2">
              <Input
                id={`add-${business.id}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="07xx xxx xxx"
              />
              <select
                aria-label="Their job"
                value={role}
                onChange={(e) => setRole(e.target.value as BusinessRole)}
                className="min-h-12 rounded-xl border-2 border-border bg-card px-2 text-[0.9375rem] font-bold"
              >
                {BUSINESS_ROLES.filter((r) => r.role !== "owner").map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              block
              variant="outline"
              disabled={add.isPending || phone.trim().length < 7}
              onClick={() => add.mutate()}
            >
              <UserPlus aria-hidden="true" /> Add to team
            </Button>
            <p className="text-[0.9375rem] font-medium text-muted-foreground">
              They must already have a HustlerLink account with that phone number saved.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
