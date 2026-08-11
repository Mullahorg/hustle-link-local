import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, IdCard, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/hl/primitives";
import { AuthGate } from "@/components/hl/AuthGate";
import { BackHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { frameToFile, uploadPhoto } from "@/lib/media";
import { timeAgo } from "@/lib/format";
import {
  DOC_TYPES,
  STATUS_COPY,
  myVerificationQuery,
  submitVerification,
  verificationHistoryQuery,
  type DocType,
} from "@/lib/verification";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify your identity — HustlerLink" },
      {
        name: "description",
        content:
          "Send your ID and a live selfie. Verified members win more work and hire with confidence.",
      },
      { property: "og:title", content: "Verify your identity — HustlerLink" },
      {
        property: "og:description",
        content: "A two minute ID check that unlocks the verified badge on your profile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyScreen,
});

type Shot = { file: File; preview: string } | null;

function VerifyScreen() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-screen-sm pb-24">
        <BackHeader title="Verify your identity" to="/settings" />
        <AuthGate
          title="Sign in to verify"
          body="Your documents stay private and are only seen by our review team."
        >
          <VerifyFlow />
        </AuthGate>
      </div>
    </div>
  );
}

function VerifyFlow() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const current = useQuery(myVerificationQuery(user?.id));
  const history = useQuery(verificationHistoryQuery(user?.id));

  const [docType, setDocType] = useState<DocType>("national_id");
  const [front, setFront] = useState<Shot>(null);
  const [back, setBack] = useState<Shot>(null);
  const [selfie, setSelfie] = useState<Shot>(null);
  const [last4, setLast4] = useState("");
  const [restart, setRestart] = useState(false);

  const spec = DOC_TYPES.find((item) => item.value === docType)!;
  const status = current.data?.status ?? "unverified";
  const locked = (status === "pending" || status === "verified") && !restart;

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (!front) throw new Error("Add a photo of the front of your document");
      if (spec.needsBack && !back) throw new Error("Add a photo of the back too");
      if (!selfie) throw new Error("Take a live selfie so we can match your face");

      const [frontPath, backPath, selfiePath] = await Promise.all([
        uploadPhoto({ bucket: "verification", userId: user.id, file: front.file, label: "front" }),
        back
          ? uploadPhoto({ bucket: "verification", userId: user.id, file: back.file, label: "back" })
          : Promise.resolve(null),
        uploadPhoto({
          bucket: "verification",
          userId: user.id,
          file: selfie.file,
          label: "selfie",
        }),
      ]);

      await submitVerification({
        docType,
        frontPath,
        backPath,
        selfiePath,
        last4: /^\d{4}$/.test(last4) ? last4 : null,
      });
    },
    onSuccess: async () => {
      setFront(null);
      setBack(null);
      setSelfie(null);
      setRestart(false);
      await queryClient.invalidateQueries({ queryKey: ["my-verification"] });
      await queryClient.invalidateQueries({ queryKey: ["verification-history"] });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Sent for review", { description: "We usually reply within a day." });
    },
    onError: (error: Error) => toast.error("Could not send", { description: error.message }),
  });

  const copy = STATUS_COPY[status] ?? STATUS_COPY["unverified"]!;

  return (
    <div className="space-y-8 px-5 pt-6">
      {/* Progress and status ------------------------------------------ */}
      <section className="rounded-3xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-extrabold text-foreground">{copy.title}</h1>
          <Chip tone={status === "verified" ? "success" : status === "pending" ? "accent" : "muted"}>
            {status}
          </Chip>
        </div>
        <p className="mt-2 text-[0.9375rem] font-medium text-muted-foreground">{copy.body}</p>

        {status === "rejected" && current.data?.review_notes ? (
          <p className="mt-3 rounded-2xl bg-secondary p-4 text-[0.9375rem] font-semibold text-foreground">
            Reviewer note: {current.data.review_notes}
          </p>
        ) : null}

        {locked ? (
          <Button
            variant="outline"
            block
            size="lg"
            className="mt-4"
            onClick={() => setRestart(true)}
          >
            <RefreshCw aria-hidden="true" />
            {status === "verified" ? "Send new documents" : "Replace my documents"}
          </Button>
        ) : null}
      </section>

      {!locked ? (
        <>
          {/* Step 1 — document type ----------------------------------- */}
          <Step number={1} title="Choose your document" hint={spec.hint}>
            <div className="grid gap-3">
              {DOC_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setDocType(item.value);
                    setBack(null);
                  }}
                  aria-pressed={docType === item.value}
                  className={
                    "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left text-base font-bold " +
                    (docType === item.value
                      ? "border-primary bg-primary-soft text-primary-ink"
                      : "border-border bg-card text-foreground")
                  }
                >
                  <IdCard className="size-6" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {docType === item.value ? <Check className="size-6" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </Step>

          {/* Step 2 — document photos --------------------------------- */}
          <Step
            number={2}
            title="Photograph your document"
            hint="Good light, no flash, all four corners in frame."
          >
            <div className="grid gap-3">
              <PhotoSlot label="Front of document" shot={front} onPick={setFront} />
              {spec.needsBack ? (
                <PhotoSlot label="Back of document" shot={back} onPick={setBack} />
              ) : null}
            </div>
            <label className="mt-4 block text-base font-bold" htmlFor="verify-last4">
              Last 4 digits of the number (optional)
            </label>
            <Input
              id="verify-last4"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(event) => setLast4(event.target.value.replace(/\D/g, ""))}
              placeholder="1234"
              className="mt-1.5 h-14 text-base"
            />
          </Step>

          {/* Step 3 — live selfie ------------------------------------- */}
          <Step
            number={3}
            title="Take a live selfie"
            hint="Look straight at the camera in a bright place."
          >
            <SelfieCapture shot={selfie} onCapture={setSelfie} />
          </Step>

          <Button
            block
            size="lg"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
            className="sticky bottom-5"
          >
            {submit.isPending ? "Sending…" : "Send for review"}
          </Button>

          <p className="text-center text-[0.875rem] font-semibold text-muted-foreground">
            Your documents are stored privately and never shown on your public profile.
          </p>
        </>
      ) : null}

      {/* History ------------------------------------------------------ */}
      {history.data && history.data.length > 0 ? (
        <section>
          <h2 className="text-xl font-extrabold text-foreground">Verification history</h2>
          <ul className="mt-3 space-y-2">
            {history.data.map((event) => (
              <li
                key={event.id}
                className="rounded-2xl border-2 border-border bg-card px-4 py-3 text-[0.9375rem]"
              >
                <p className="font-extrabold text-foreground">{readable(event.action)}</p>
                {event.notes ? (
                  <p className="mt-1 font-medium text-muted-foreground">{event.notes}</p>
                ) : null}
                <p className="mt-1 font-bold text-muted-foreground">{timeAgo(event.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-[0.9375rem] font-semibold text-muted-foreground">
        Questions about verification?{" "}
        <Link to="/about" className="font-extrabold text-primary-ink underline">
          Read how it works
        </Link>
      </p>
    </div>
  );
}

function readable(action: string) {
  return action
    .replace(/[._]/g, " ")
    .replace(/^\w/, (character) => character.toUpperCase())
    .trim();
}

function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground">
          {number}
        </span>
        <h2 className="text-xl font-extrabold text-foreground">{title}</h2>
      </div>
      <p className="mt-1.5 ml-12 text-[0.9375rem] font-medium text-muted-foreground">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PhotoSlot({
  label,
  shot,
  onPick,
}: {
  label: string;
  shot: Shot;
  onPick: (shot: Shot) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-3xl border-2 border-dashed border-border-strong bg-card p-4">
      <div className="flex items-center gap-4">
        {shot ? (
          <img
            src={shot.preview}
            alt=""
            className="size-20 rounded-2xl border-2 border-border object-cover"
          />
        ) : (
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
            <Camera className="size-8" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-foreground">{label}</p>
          <p className="text-[0.875rem] font-semibold text-muted-foreground">
            {shot ? "Looks good — tap to retake" : "Tap to take or choose a photo"}
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick({ file, preview: URL.createObjectURL(file) });
          event.target.value = "";
        }}
      />
      <Button variant="outline" block size="lg" className="mt-4" onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        {shot ? "Retake" : "Add photo"}
      </Button>
    </div>
  );
}

function SelfieCapture({ shot, onCapture }: { shot: Shot; onCapture: (shot: Shot) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  async function start() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 720 },
      });
      setStream(media);
      setLive(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
      });
    } catch {
      toast.error("Camera blocked", { description: "Allow camera access to take a live selfie." });
    }
  }

  async function capture() {
    if (!video.current) return;
    const file = await frameToFile(video.current);
    onCapture({ file, preview: URL.createObjectURL(file) });
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setLive(false);
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-border-strong bg-card p-4">
      {live ? (
        <>
          <video
            ref={video}
            playsInline
            muted
            className="aspect-square w-full rounded-2xl border-2 border-border object-cover"
          />
          <Button block size="lg" className="mt-4" onClick={() => void capture()}>
            <Camera aria-hidden="true" />
            Capture selfie
          </Button>
        </>
      ) : shot ? (
        <>
          <img
            src={shot.preview}
            alt=""
            className="aspect-square w-full rounded-2xl border-2 border-border object-cover"
          />
          <Button variant="outline" block size="lg" className="mt-4" onClick={() => void start()}>
            <RefreshCw aria-hidden="true" />
            Take another
          </Button>
        </>
      ) : (
        <>
          <div className="grid aspect-square w-full place-items-center rounded-2xl bg-primary-soft text-primary-ink">
            <Camera className="size-12" aria-hidden="true" />
          </div>
          <Button block size="lg" className="mt-4" onClick={() => void start()}>
            Open camera
          </Button>
        </>
      )}
    </div>
  );
}
