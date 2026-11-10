"use client";

import { useState } from "react";
import { FormError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { EMAIL_RECOVERY_AVAILABLE } from "@/lib/auth/features";
import { generateRecoveryCodes, recoveryFileText } from "@/lib/auth/recovery";
import { isEmail, validatePassword, validateUsername } from "@/lib/auth/validation";
import { downloadText } from "@/lib/browser/download";
import type { Viewer } from "@/lib/sample/viewer";
import { canConfirmDelete, maskEmail } from "@/lib/settings/settings";

type SheetBase = { open: boolean; onClose: () => void };

/** A save that may fail on the server: resolves to an error message, or null when it worked. */
export type Save<T> = (value: T) => Promise<string | null>;

const NETWORK = "Couldn't reach InternQuest. Check your connection and try again.";

/** Runs a save, turning a thrown network error into a message. */
async function attempt<T>(save: Save<T>, value: T): Promise<string | null> {
  try {
    return await save(value);
  } catch {
    return NETWORK;
  }
}

/* ------------------------------------------------------------------------ */
/* Username                                                                  */
/* ------------------------------------------------------------------------ */

/** The server re-checks the rules and availability; the unique index on profiles.username is the final guard. */
export function UsernameSheet({ open, onClose, current, onSave }: SheetBase & { current: string; onSave: Save<string> }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change username" description="It's shown on the leaderboard and on your share card.">
      {open && <UsernameForm current={current} onSave={onSave} />}
    </Sheet>
  );
}

function UsernameForm({ current, onSave }: { current: string; onSave: Save<string> }) {
  const [value, setValue] = useState(current);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<{ for: string; message: string } | null>(null);
  const check = validateUsername(value);
  const error = !tried
    ? undefined
    : !check.ok
      ? check.error
      : check.value === current
        ? "That's already your username."
        : serverError?.for === check.value
          ? serverError.message
          : undefined;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (!check.ok || check.value === current) return;
        setBusy(true);
        const message = await attempt(onSave, check.value);
        setBusy(false);
        if (message) setServerError({ for: check.value, message });
      }}
      className="space-y-4"
    >
      <TextField
        label="New username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        hint="3 to 20 letters, numbers, dots, or underscores. Avoid your real name. You'll log in with the new one."
        error={error}
      />
      <Button type="submit" block loading={busy}>
        Save username
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Password                                                                  */
/* ------------------------------------------------------------------------ */

/** The server checks the current password, then signs out every other device. */
export function PasswordSheet({
  open,
  onClose,
  username,
  onSave,
}: SheetBase & { username: string; onSave: Save<{ current: string; next: string }> }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      {open && <PasswordForm username={username} onSave={onSave} />}
    </Sheet>
  );
}

function PasswordForm({ username, onSave }: { username: string; onSave: Save<{ current: string; next: string }> }) {
  const [currentPw, setCurrentPw] = useState(""); // never stored
  const [next, setNext] = useState(""); // never stored
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const check = validatePassword(next, username);
  const currentError = tried && !currentPw ? "Type your current password." : undefined;
  const nextError = !tried
    ? undefined
    : !check.ok
      ? check.error
      : next === currentPw
        ? "Pick a password you haven't used here."
        : undefined;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        setServerError(null);
        if (!currentPw || !check.ok || next === currentPw) return;
        setBusy(true);
        const message = await attempt(onSave, { current: currentPw, next });
        setBusy(false);
        if (message) setServerError(message);
      }}
      className="space-y-4"
    >
      {serverError && <FormError message={serverError} />}
      <PasswordField
        label="Current password"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
        autoComplete="current-password"
        maxLength={128}
        error={currentError}
      />
      <PasswordField
        label="New password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        maxLength={128}
        hint="At least 10 characters. A short sentence works well."
        error={nextError}
      />
      <p className="text-sm text-muted">You&apos;ll stay signed in here. Other devices will need the new password.</p>
      <Button type="submit" block loading={busy}>
        Save password
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Recovery                                                                  */
/* ------------------------------------------------------------------------ */

type Recovery = Viewer["recovery"];

/**
 * Make new codes (old ones stop working). The codes are made in this browser
 * and saved on the server as hashes before they're shown as active.
 * A recovery email appears only once an email service is connected.
 */
export function RecoverySheet({
  open,
  onClose,
  username,
  recovery,
  onSaveCodes,
  onSaveEmail,
}: SheetBase & {
  username: string;
  recovery: Recovery;
  onSaveCodes: Save<string[]>;
  onSaveEmail: Save<string>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Password recovery" description="How you get back in if you forget your password.">
      {open && (
        <RecoveryBody username={username} recovery={recovery} onSaveCodes={onSaveCodes} onSaveEmail={onSaveEmail} onDone={onClose} />
      )}
    </Sheet>
  );
}

function RecoveryBody({
  username,
  recovery,
  onSaveCodes,
  onSaveEmail,
  onDone,
}: {
  username: string;
  recovery: Recovery;
  onSaveCodes: Save<string[]>;
  onSaveEmail: Save<string>;
  onDone: () => void;
}) {
  const [view, setView] = useState<"menu" | "codes" | "email">("menu");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState(recovery.kind === "email" ? recovery.email : "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (view === "codes") {
    return (
      <div>
        <p className="text-base">Your old codes stopped working. Each of these works once.</p>
        <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border border-line bg-canvas p-3 font-mono text-base" aria-label="Your new recovery codes">
          {codes.map((c) => (
            <li key={c} className="tracking-wider">
              {c}
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          className="mt-3"
          icon={<PixelIcon name="download" scale={2} />}
          onClick={() => downloadText(recoveryFileText(username, codes, new Date()), `internquest-recovery-${username}.txt`)}
        >
          Download
        </Button>
        <div className="mt-2">
          <Checkbox label="I saved these codes somewhere safe" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        </div>
        <Button block className="mt-3" disabled={!saved} onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  if (view === "email") {
    const error = tried && !isEmail(email) ? "That doesn't look like an email address yet." : undefined;
    return (
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setTried(true);
          setServerError(null);
          if (!isEmail(email)) return;
          setBusy(true);
          const message = await attempt(onSaveEmail, email.trim());
          setBusy(false);
          if (message) setServerError(message);
          else onDone();
        }}
        className="space-y-4"
      >
        {serverError && <FormError message={serverError} />}
        <TextField
          label="Recovery email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Only used to reset your password. Never for ads, never shown to anyone."
          error={error}
        />
        <Button type="submit" block loading={busy}>
          Save email
        </Button>
        <Button variant="ghost" block onClick={() => setView("menu")}>
          Back
        </Button>
      </form>
    );
  }

  const makeCodes = async () => {
    setServerError(null);
    const fresh = generateRecoveryCodes();
    setBusy(true);
    const message = await attempt(onSaveCodes, fresh);
    setBusy(false);
    if (message) {
      setServerError(message);
      return;
    }
    setCodes(fresh);
    setSaved(false);
    setView("codes");
  };

  return (
    <div>
      {serverError && <FormError message={serverError} />}
      <p className="mt-4 border-l-4 border-ink bg-canvas p-3 text-base first:mt-0">
        {recovery.kind === "codes"
          ? `You're using recovery codes. ${recovery.codesLeft} of 8 are unused.`
          : recovery.kind === "email"
            ? `You're using a recovery email: ${maskEmail(recovery.email)}.`
            : "You don't have a way to reset your password yet. If you forget it, the account can't be recovered."}
      </p>
      <div className="mt-4 grid gap-2">
        <Button variant={recovery.kind === "none" ? "primary" : "secondary"} block loading={busy} onClick={() => void makeCodes()}>
          {recovery.kind === "codes" ? "Make new codes" : "Use recovery codes"}
        </Button>
        {EMAIL_RECOVERY_AVAILABLE && (
          <Button variant="secondary" block disabled={busy} onClick={() => setView("email")}>
            {recovery.kind === "email" ? "Change recovery email" : "Use a recovery email"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Delete account                                                            */
/* ------------------------------------------------------------------------ */

/**
 * The server deletes the sign-in user, which removes every row that belongs
 * to them (cascade), then signs out. Cannot be undone.
 */
export function DeleteAccountSheet({
  open,
  onClose,
  username,
  onDownload,
  onDelete,
}: SheetBase & { username: string; onDownload: () => void; onDelete: Save<string> }) {
  return (
    <Sheet open={open} onClose={onClose} title="Delete your account?" description="This can't be undone.">
      {open && <DeleteForm username={username} onDownload={onDownload} onDelete={onDelete} onCancel={onClose} />}
    </Sheet>
  );
}

function DeleteForm({
  username,
  onDownload,
  onDelete,
  onCancel,
}: {
  username: string;
  onDownload: () => void;
  onDelete: Save<string>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const ok = canConfirmDelete(typed, username);

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        setServerError(null);
        const message = await attempt(onDelete, typed);
        // On success the page navigates away, so only a failure lands here.
        setBusy(false);
        if (message) setServerError(message);
      }}
      className="space-y-4"
    >
      {serverError && <FormError message={serverError} />}
      <div>
        <p className="font-semibold">We delete everything tied to you:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-base">
          <li>your profile, skills, and city</li>
          <li>your quest log and notes</li>
          <li>EXP, badges, streaks, and leaderboard rows</li>
          <li>your recovery email or codes</li>
        </ul>
        <p className="mt-2 text-sm text-muted">Apply-click counts that listings keep no longer point to you.</p>
      </div>
      <Button variant="secondary" icon={<PixelIcon name="download" scale={2} />} onClick={onDownload}>
        Download my data first
      </Button>
      <TextField
        label={`Type ${username} to confirm`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <div className="grid gap-2">
        <Button type="submit" variant="danger" block disabled={!ok} loading={busy}>
          Delete my account
        </Button>
        <Button variant="secondary" block onClick={onCancel}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
