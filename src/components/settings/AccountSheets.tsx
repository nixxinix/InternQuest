"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { Sheet } from "@/components/ui/Sheet";
import { generateRecoveryCodes, recoveryFileText } from "@/lib/auth/recovery";
import { isEmail, validatePassword, validateUsername } from "@/lib/auth/validation";
import { downloadText } from "@/lib/browser/download";
import { isUsernameTaken } from "@/lib/sample/accounts";
import type { Viewer } from "@/lib/sample/viewer";
import { canConfirmDelete, maskEmail } from "@/lib/settings/settings";

type SheetBase = { open: boolean; onClose: () => void };

/* ------------------------------------------------------------------------ */
/* Username                                                                  */
/* ------------------------------------------------------------------------ */

/** TODO(Phase 1): server action; the unique index on profiles.username is the real guard. */
export function UsernameSheet({ open, onClose, current, onSave }: SheetBase & { current: string; onSave: (u: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change username" description="It's shown on the leaderboard and on your share card.">
      {open && <UsernameForm current={current} onSave={onSave} />}
    </Sheet>
  );
}

function UsernameForm({ current, onSave }: { current: string; onSave: (u: string) => void }) {
  const [value, setValue] = useState(current);
  const [tried, setTried] = useState(false);
  const check = validateUsername(value);
  const error = !tried
    ? undefined
    : !check.ok
      ? check.error
      : check.value === current
        ? "That's already your username."
        : isUsernameTaken(check.value)
          ? "That one's taken."
          : undefined;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (check.ok && check.value !== current && !isUsernameTaken(check.value)) onSave(check.value);
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
        hint="3 to 20 letters, numbers, dots, or underscores. Avoid your real name."
        error={error}
      />
      <Button type="submit" block>
        Save username
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Password                                                                  */
/* ------------------------------------------------------------------------ */

/** TODO(Phase 1): the server checks the current password and signs out other devices. */
export function PasswordSheet({ open, onClose, username, onSave }: SheetBase & { username: string; onSave: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      {open && <PasswordForm username={username} onSave={onSave} />}
    </Sheet>
  );
}

function PasswordForm({ username, onSave }: { username: string; onSave: () => void }) {
  const [currentPw, setCurrentPw] = useState(""); // never stored
  const [next, setNext] = useState(""); // never stored
  const [tried, setTried] = useState(false);
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
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (currentPw && check.ok && next !== currentPw) onSave();
      }}
      className="space-y-4"
    >
      <PasswordField label="Current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" error={currentError} />
      <PasswordField
        label="New password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence works well."
        error={nextError}
      />
      <p className="text-sm text-muted">You&apos;ll stay signed in here. Other devices will need the new password.</p>
      <Button type="submit" block>
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
 * Make new codes (old ones stop working) or use a recovery email instead.
 * TODO(Phase 1): codes are generated on the server and only their hashes are stored.
 */
export function RecoverySheet({
  open,
  onClose,
  username,
  recovery,
  onChange,
}: SheetBase & { username: string; recovery: Recovery; onChange: (r: Recovery) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Password recovery" description="How you get back in if you forget your password.">
      {open && <RecoveryBody username={username} recovery={recovery} onChange={onChange} onDone={onClose} />}
    </Sheet>
  );
}

function RecoveryBody({
  username,
  recovery,
  onChange,
  onDone,
}: {
  username: string;
  recovery: Recovery;
  onChange: (r: Recovery) => void;
  onDone: () => void;
}) {
  const [view, setView] = useState<"menu" | "codes" | "email">("menu");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState(recovery.kind === "email" ? recovery.email : "");
  const [tried, setTried] = useState(false);

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
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!isEmail(email)) return;
          onChange({ kind: "email", email: email.trim() });
          onDone();
        }}
        className="space-y-4"
      >
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
        <Button type="submit" block>
          Save email
        </Button>
        <Button variant="ghost" block onClick={() => setView("menu")}>
          Back
        </Button>
      </form>
    );
  }

  return (
    <div>
      <p className="border-l-4 border-ink bg-canvas p-3 text-base">
        {recovery.kind === "codes"
          ? `You're using recovery codes. ${recovery.codesLeft} of 8 are unused.`
          : recovery.kind === "email"
            ? `You're using a recovery email: ${maskEmail(recovery.email)}.`
            : "You don't have a way to reset your password yet. If you forget it, the account can't be recovered."}
      </p>
      <div className="mt-4 grid gap-2">
        <Button
          variant={recovery.kind === "none" ? "primary" : "secondary"}
          block
          onClick={() => {
            const fresh = generateRecoveryCodes();
            setCodes(fresh);
            setSaved(false);
            onChange({ kind: "codes", codesLeft: fresh.length });
            setView("codes");
          }}
        >
          {recovery.kind === "codes" ? "Make new codes" : "Use recovery codes"}
        </Button>
        <Button variant="secondary" block onClick={() => setView("email")}>
          {recovery.kind === "email" ? "Change recovery email" : "Use a recovery email"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Delete account                                                            */
/* ------------------------------------------------------------------------ */

/**
 * TODO(Phase 1): server action that deletes the auth user and every row that
 * belongs to them (cascade), then signs out. Cannot be undone.
 */
export function DeleteAccountSheet({
  open,
  onClose,
  username,
  onDownload,
  onDelete,
}: SheetBase & { username: string; onDownload: () => void; onDelete: () => void }) {
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
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = canConfirmDelete(typed, username);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        setBusy(true);
        onDelete();
      }}
      className="space-y-4"
    >
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
