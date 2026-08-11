import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, BackHeader } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/hl/AuthGate";
import { Avatar, CardSkeleton, Chip } from "@/components/hl/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { myProfileQuery, requestVerification, updateMyProfile } from "@/lib/account";
import { deleteMyAccount } from "@/lib/account.functions";
import { homeFeedQuery } from "@/lib/queries";
import { blockedUsersQuery, completedJobsQuery, unblockUser } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HustlerLink" },
      { name: "description", content: "Your profile, skills, privacy and account settings." },
      { property: "og:title", content: "Settings — HustlerLink" },
      {
        property: "og:description",
        content: "Your profile, skills, privacy and account settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsScreen,
});

const PREFS_KEY = "hl:prefs";
type Prefs = { jobAlerts: boolean; messageAlerts: boolean; lessData: boolean };
const defaultPrefs: Prefs = { jobAlerts: true, messageAlerts: true, lessData: false };

function SettingsScreen() {
  return (
    <AppShell>
      <BackHeader title="Settings" to="/profile" />
      <div className="pt-6">
        <AuthGate
          title="Sign in to manage your account"
          body="Your profile, skills and privacy settings live here."
        >
          <SettingsBody />
        </AuthGate>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5">
      <h2 className="mb-3 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SettingsBody() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile, isPending } = useQuery(myProfileQuery(user?.id));
  const feed = useQuery(homeFeedQuery());
  const blocked = useQuery(blockedUsersQuery(user?.id));
  const completed = useQuery(completedJobsQuery(user?.id));

  const [form, setForm] = useState({
    full_name: "",
    headline: "",
    bio: "",
    area: "",
    phone: "",
    rate_label: "",
    category_slug: "",
    is_worker: false,
    available: true,
    skills: [] as string[],
  });
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [last4, setLast4] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      area: profile.area ?? "",
      phone: profile.phone ?? "",
      rate_label: profile.rate_label ?? "",
      category_slug: profile.category_slug ?? "",
      is_worker: profile.is_worker,
      available: profile.available,
      skills: profile.skills ?? [],
    });
  }, [profile]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) setPrefs({ ...defaultPrefs, ...(JSON.parse(stored) as Partial<Prefs>) });
    } catch {
      /* ignore */
    }
  }, []);

  function savePrefs(next: Prefs) {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const nameError = form.full_name.trim().length < 2 ? "Please enter your name" : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (nameError) throw new Error(nameError);
      await updateMyProfile(user.id, {
        full_name: form.full_name.trim(),
        headline: form.headline.trim() || null,
        bio: form.bio.trim() || null,
        area: form.area.trim() || null,
        phone: form.phone.trim() || null,
        rate_label: form.rate_label.trim() || null,
        category_slug: form.category_slug || null,
        is_worker: form.is_worker,
        available: form.available,
        skills: form.skills,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
    },
    onError: (error: Error) => toast.error("Could not save", { description: error.message }),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!/^\d{4}$/.test(last4)) throw new Error("Enter the last 4 digits of your ID");
      await requestVerification(user.id, last4);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Verification requested", { description: "We'll review it shortly." });
    },
    onError: (error: Error) => toast.error("Could not send", { description: error.message }),
  });

  const unblock = useMutation({
    mutationFn: (id: string) => unblockUser(user!.id, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      toast.success("Unblocked");
    },
    onError: (error: Error) => toast.error("Could not unblock", { description: error.message }),
  });

  const remove = useMutation({
    mutationFn: () => deleteMyAccount({ data: undefined }),
    onSuccess: async () => {
      await signOut();
      toast.success("Your account has been deleted");
      void navigate({ to: "/" });
    },
    onError: (error: Error) =>
      toast.error("Could not delete your account", { description: error.message }),
  });

  if (isPending) {
    return (
      <div className="px-5">
        <CardSkeleton rows={3} />
      </div>
    );
  }

  const categories = feed.data?.categories ?? [];

  return (
    <div className="space-y-9 pb-10">
      <Section title="Profile">
        <div className="space-y-5 rounded-3xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <Avatar name={form.full_name} url={profile?.avatar_url} />
            <div className="min-w-0">
              <p className="text-base font-extrabold">{form.full_name || "Your name"}</p>
              <p className="text-[0.9375rem] font-semibold text-muted-foreground">
                {completed.data ?? 0} completed job{completed.data === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="s-name" className="mb-1.5 block text-base font-bold">
              Full name
            </label>
            <Input
              id="s-name"
              autoComplete="name"
              value={form.full_name}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="h-14 text-base"
            />
            {nameError ? (
              <p className="mt-1 text-sm font-bold text-destructive">{nameError}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="s-headline" className="mb-1.5 block text-base font-bold">
              One line about you
            </label>
            <Input
              id="s-headline"
              maxLength={70}
              value={form.headline}
              onChange={(event) => setForm({ ...form, headline: event.target.value })}
              placeholder="Plumber · 8 years experience"
              className="h-14 text-base"
            />
            <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
              {form.headline.length}/70
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-area" className="mb-1.5 block text-base font-bold">
                Area
              </label>
              <Input
                id="s-area"
                autoComplete="address-level2"
                value={form.area}
                onChange={(event) => setForm({ ...form, area: event.target.value })}
                placeholder="Kasarani"
                className="h-14 text-base"
              />
            </div>
            <div>
              <label htmlFor="s-phone" className="mb-1.5 block text-base font-bold">
                Phone
              </label>
              <Input
                id="s-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="07xx xxx xxx"
                className="h-14 text-base"
              />
            </div>
          </div>

          <div>
            <label htmlFor="s-bio" className="mb-1.5 block text-base font-bold">
              About your work
            </label>
            <Textarea
              id="s-bio"
              maxLength={400}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
              className="min-h-28 text-base"
            />
            <p className="mt-1 text-right text-sm font-semibold text-muted-foreground">
              {form.bio.length}/400
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-secondary p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold">I'm looking for work</span>
              <span className="mt-0.5 block text-[0.9375rem] font-medium text-muted-foreground">
                Show my profile to employers
              </span>
            </span>
            <Switch
              checked={form.is_worker}
              onCheckedChange={(value) => setForm({ ...form, is_worker: value })}
              aria-label="Show my profile to employers"
            />
          </div>

          {form.is_worker ? (
            <>
              <div className="flex items-center gap-4 rounded-2xl bg-secondary p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">Available right now</span>
                  <span className="mt-0.5 block text-[0.9375rem] font-medium text-muted-foreground">
                    Available workers appear first in search
                  </span>
                </span>
                <Switch
                  checked={form.available}
                  onCheckedChange={(value) => setForm({ ...form, available: value })}
                  aria-label="Available right now"
                />
              </div>

              <div>
                <p className="mb-2 text-base font-bold">Your trade</p>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <button
                        type="button"
                        aria-pressed={form.category_slug === category.slug}
                        onClick={() => setForm({ ...form, category_slug: category.slug })}
                        className={cn(
                          "min-h-12 rounded-full border-2 px-4 text-base font-bold transition-colors",
                          form.category_slug === category.slug
                            ? "border-primary bg-primary-soft text-primary-ink"
                            : "border-border bg-card text-foreground",
                        )}
                      >
                        {category.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <SkillsField
                skills={form.skills}
                onChange={(skills) => setForm({ ...form, skills })}
              />

              <div>
                <label htmlFor="s-rate" className="mb-1.5 block text-base font-bold">
                  Your rate
                </label>
                <Input
                  id="s-rate"
                  value={form.rate_label}
                  onChange={(event) => setForm({ ...form, rate_label: event.target.value })}
                  placeholder="From KSh 1,500 per job"
                  className="h-14 text-base"
                />
              </div>
            </>
          ) : null}

          <Button block size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </Section>

      <Section title="Trust">
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
            <p className="text-base font-extrabold">ID verification</p>
            <Chip tone={profile?.verification === "verified" ? "success" : "muted"}>
              {profile?.verification ?? "unverified"}
            </Chip>
          </div>
          <p className="mt-2 text-[0.9375rem] font-medium text-muted-foreground">
            {profile?.verification === "verified"
              ? "Your identity is verified. The badge shows on your profile."
              : profile?.verification === "pending"
                ? "We're reviewing your documents. This usually takes a day."
                : "Send your ID and a live selfie. Verified members get hired far more often."}
          </p>
          <Button asChild block size="lg" className="mt-4">
            <Link to="/verify">
              {profile?.verification === "verified"
                ? "Manage verification"
                : profile?.verification === "pending"
                  ? "Check progress"
                  : "Verify my identity"}
            </Link>
          </Button>

        </div>
      </Section>

      <Section title="Notifications">
        <ul className="divide-y-2 divide-border overflow-hidden rounded-3xl border-2 border-border bg-card">
          {(
            [
              ["jobAlerts", "Job alerts near me", "A ping when work matches your trade"],
              ["messageAlerts", "Message notifications", "Sound for new chats"],
              ["lessData", "Use less data", "Load smaller photos on slow networks"],
            ] as const
          ).map(([key, label, hint]) => (
            <li key={key} className="flex items-center gap-4 px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">{label}</span>
                <span className="mt-0.5 block text-[0.9375rem] font-medium text-muted-foreground">
                  {hint}
                </span>
              </span>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(value) => savePrefs({ ...prefs, [key]: value })}
                aria-label={label}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Privacy — blocked people">
        {blocked.isPending ? (
          <CardSkeleton rows={1} kind="worker" />
        ) : (blocked.data ?? []).length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-border-strong bg-card p-5 text-[0.9375rem] font-semibold text-muted-foreground">
            You haven't blocked anyone. You can block someone from their profile or a chat.
          </p>
        ) : (
          <ul className="divide-y-2 divide-border overflow-hidden rounded-3xl border-2 border-border bg-card">
            {(blocked.data ?? []).map((person) => (
              <li key={person.id} className="flex items-center gap-4 px-4 py-3">
                <Avatar name={person.full_name} url={person.avatar_url} size="sm" />
                <span className="min-w-0 flex-1 truncate text-base font-bold">
                  {person.full_name}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate(person.id)}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Language">
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <p className="text-base font-bold">English (Kenya)</p>
          <p className="mt-1 text-[0.9375rem] font-medium text-muted-foreground">
            More languages are on the way.
          </p>
        </div>
      </Section>

      <Section title="Account">
        <div className="space-y-3">
          <Button variant="outline" block size="lg" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" /> Log out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" block size="lg" className="text-destructive">
                <Trash2 aria-hidden="true" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[92vw] rounded-3xl sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-extrabold">
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[0.9375rem] font-medium text-muted-foreground">
                  This removes your profile, jobs, applications and messages. It cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-12">Keep my account</AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-12 bg-destructive text-destructive-foreground"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? "Deleting…" : "Delete for good"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  );
}

function SkillsField({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const suggestions = ["Wiring", "Pipes", "Tiling", "Painting", "Welding", "Cleaning", "Roofing"];

  function add(skill: string) {
    const clean = skill.trim();
    if (!clean || skills.includes(clean) || skills.length >= 10) return;
    onChange([...skills, clean]);
    setValue("");
  }

  return (
    <div>
      <label htmlFor="s-skill" className="mb-1.5 block text-base font-bold">
        Your skills <span className="font-semibold text-muted-foreground">(up to 10)</span>
      </label>
      {skills.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill}>
              <button
                type="button"
                onClick={() => onChange(skills.filter((item) => item !== skill))}
                aria-label={`Remove ${skill}`}
                className="min-h-11 rounded-full bg-primary-soft px-4 text-[0.9375rem] font-bold text-primary-ink"
              >
                {skill} ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-3">
        <Input
          id="s-skill"
          value={value}
          enterKeyHint="done"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(value);
            }
          }}
          placeholder="Add a skill"
          className="h-14 flex-1 text-base"
        />
        <Button type="button" size="lg" variant="outline" onClick={() => add(value)}>
          Add
        </Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {suggestions
          .filter((item) => !skills.includes(item))
          .map((item) => (
            <li key={item}>
              <button
                type="button"
                onClick={() => add(item)}
                className="min-h-11 rounded-full border-2 border-border bg-card px-4 text-[0.9375rem] font-bold"
              >
                + {item}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
