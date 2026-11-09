"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Avatar, type AvatarLook } from "@/components/game/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { PixelIcon } from "@/components/ui/PixelIcon";
import { SPRITES } from "@/components/ui/sprites";
import { downloadBlob } from "@/lib/browser/download";
import { DEFAULT_SHARE, canShare, shareLines, shareText, type ShareLine, type ShareOptions, type ShareStats } from "@/lib/profile/share";

type ShareCardEditorProps = {
  stats: ShareStats;
  look: AvatarLook;
  /** Full Quest: avatar and streak. Light: neither. */
  showAvatar: boolean;
  streakAllowed: boolean;
};

/** Pick what's on the card, see it, then download it as an image or copy it as text. */
export function ShareCardEditor({ stats, look, showAvatar, streakAllowed }: ShareCardEditorProps) {
  const [show, setShow] = useState<ShareOptions>(DEFAULT_SHARE);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const probe = useRef<HTMLSpanElement>(null);

  const lines = shareLines(stats, show, streakAllowed);
  const ok = canShare(show, lines);
  const toggle = (key: keyof ShareOptions) => (e: { target: { checked: boolean } }) => {
    setShow((s) => ({ ...s, [key]: e.target.checked }));
    setStatus("");
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderShareImage({
        username: show.username ? stats.username : null,
        lines,
        look: showAvatar ? look : null,
        siteUrl: window.location.host,
        pixelFont: probe.current ? getComputedStyle(probe.current).fontFamily : "monospace",
        sansFont: getComputedStyle(document.body).fontFamily,
      });
      downloadBlob(blob, `internquest-progress${show.username ? `-${stats.username}` : ""}.png`);
      setStatus("Image saved to your downloads.");
    } catch {
      setStatus("Couldn't make the image on this browser. Try Copy text instead.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(stats, show, streakAllowed, window.location.origin));
      setStatus("Copied. Paste it anywhere.");
    } catch {
      setStatus("Copying is blocked on this browser. Download the image instead.");
    }
  };

  return (
    <div>
      {/* Hidden probe: reads the real pixel font family so the image matches the page. */}
      <span ref={probe} aria-hidden="true" className="sr-only font-pixel">
        .
      </span>

      <ShareCardPreview username={show.username ? stats.username : null} lines={lines} look={showAvatar ? look : null} />

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Show on the card</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          <Checkbox label="Username" checked={show.username} onChange={toggle("username")} />
          <Checkbox label="Level" checked={show.level} onChange={toggle("level")} />
          <Checkbox label="Applications" checked={show.applications} onChange={toggle("applications")} />
          {streakAllowed && stats.streakWeeks > 0 && <Checkbox label="Streak" checked={show.streak} onChange={toggle("streak")} />}
          <Checkbox label="Total EXP" checked={show.exp} onChange={toggle("exp")} />
        </div>
      </fieldset>

      {!ok && <p className="mt-2 text-sm font-semibold text-alert">Pick at least one thing to show.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={download} disabled={!ok} loading={busy} icon={<PixelIcon name="download" scale={2} />}>
          Download image
        </Button>
        <Button variant="secondary" onClick={copy} disabled={!ok}>
          Copy text
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {status}
      </p>
      <p className="text-sm text-muted">The card links to InternQuest&apos;s home page, not to your profile. Nothing is posted for you.</p>
    </div>
  );
}

/** The card as it will look in the image. Text is real text, so screen readers can read the preview. */
export function ShareCardPreview({ username, lines, look }: { username: string | null; lines: ShareLine[]; look: AvatarLook | null }) {
  const host = useSiteHost();
  return (
    <figure aria-label="Share card preview" className="on-bezel aspect-square w-full max-w-sm p-[6%] shadow-raised">
      <div className="flex h-full flex-col border-4 border-bezel-raised p-[7%]">
        <p className="font-pixel text-hud-sm uppercase text-lime">InternQuest</p>
        <div className="mt-[6%] flex items-center gap-3">
          {look && (
            <div className="flex-none bg-bezel-raised p-1.5">
              <Avatar look={look} scale={4} />
            </div>
          )}
          {/* Usernames have no spaces: wrap only at a dot or underscore, or as a last resort. */}
          {username && <p className="min-w-0 text-xl font-semibold [overflow-wrap:anywhere]">{username}</p>}
        </div>
        <ul className="mt-auto space-y-2">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-2 font-pixel text-hud uppercase">
              <span aria-hidden="true" className="size-2.5 flex-none bg-lime" />
              {l.text}
            </li>
          ))}
        </ul>
        <p className="mt-[6%] text-xs text-bezel-text">
          Find internships near you{host ? ` · ${host}` : ""}
        </p>
      </div>
    </figure>
  );
}

const noSubscribe = () => () => {};

/** The site's address. Empty during server rendering and hydration, so both renders match. */
function useSiteHost(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.host,
    () => "",
  );
}

/* ------------------------------------------------------------------------ */
/* Image export: drawn on a canvas with the page's own fonts (no library).  */
/* ------------------------------------------------------------------------ */

const SIZE = 1080;

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

async function renderShareImage(card: {
  username: string | null;
  lines: ShareLine[];
  look: AvatarLook | null;
  siteUrl: string;
  pixelFont: string;
  sansFont: string;
}): Promise<Blob> {
  const bezel = token("--color-bezel", "#16202a");
  const raised = token("--color-bezel-raised", "#243241");
  const lime = token("--color-lime", "#a6f05a");
  const white = token("--color-screen", "#ffffff");
  const muted = token("--color-bezel-text", "#c9d3ce");

  await document.fonts.ready;
  await Promise.all([document.fonts.load(`40px ${card.pixelFont}`), document.fonts.load(`600 72px ${card.sansFont}`)]);

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.imageSmoothingEnabled = false;

  // Frame
  ctx.fillStyle = bezel;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = raised;
  ctx.fillRect(64, 64, SIZE - 128, SIZE - 128);
  ctx.fillStyle = bezel;
  ctx.fillRect(80, 80, SIZE - 160, SIZE - 160);

  const left = 140;
  ctx.textBaseline = "top";
  ctx.fillStyle = lime;
  ctx.font = `40px ${card.pixelFont}`;
  ctx.fillText("INTERNQUEST", left, 140);

  // Avatar and username
  let y = 250;
  let textLeft = left;
  if (card.look) {
    const scale = 16; // 12 x 16 = 192px
    ctx.fillStyle = raised;
    ctx.fillRect(left, y, 12 * scale + 32, 12 * scale + 32);
    drawAvatar(ctx, card.look, left + 16, y + 16, scale, lime);
    textLeft = left + 12 * scale + 32 + 40;
  }
  if (card.username) {
    ctx.fillStyle = white;
    ctx.font = `600 64px ${card.sansFont}`;
    ctx.textBaseline = "middle";
    ctx.fillText(card.username, textLeft, card.look ? y + (12 * 16 + 32) / 2 : y + 40, SIZE - textLeft - 140);
    ctx.textBaseline = "top";
  }

  // Stat lines, bottom-up
  ctx.font = `48px ${card.pixelFont}`;
  y = SIZE - 230 - card.lines.length * 76;
  for (const l of card.lines) {
    ctx.fillStyle = lime;
    ctx.fillRect(left, y + 14, 22, 22);
    ctx.fillText(l.text.toUpperCase(), left + 48, y, SIZE - left - 188);
    y += 76;
  }

  ctx.fillStyle = muted;
  ctx.font = `32px ${card.sansFont}`;
  ctx.fillText(`Find internships near you · ${card.siteUrl}`, left, SIZE - 190, SIZE - 280);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Same art as the on-screen avatar (SPRITES.avatar), with the palette resolved to real colors. */
function drawAvatar(ctx: CanvasRenderingContext2D, look: AvatarLook, x0: number, y0: number, scale: number, lime: string) {
  const colors: Record<string, string> = {
    s: look.skin,
    H: look.hair,
    S: look.shirt ?? lime,
    e: "#1b1410",
    m: "#8a4b32",
  };
  SPRITES.avatar.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const fill = colors[c];
      if (!fill) return;
      ctx.fillStyle = fill;
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    });
  });
}
