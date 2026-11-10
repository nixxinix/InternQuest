import { appIcon } from "@/lib/pwa/appIcon";

/** App icons for the home screen and the install prompt (manifest.ts), served at /icon/192 and /icon/512. */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  return appIcon(Number(await id) === 512 ? 512 : 192);
}
