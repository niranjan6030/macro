/**
 * Native capabilities, when the app is running inside the iOS or Android shell.
 *
 * Everything here degrades to the web equivalent in a normal browser, so no
 * component needs to branch on platform beyond asking `isNative()`.
 */

let cached = null;

export function isNative() {
  if (cached !== null) return cached;
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  cached = Boolean(cap?.isNativePlatform?.());
  return cached;
}

/** Take a photo with the system camera. Returns a data URL, same shape the
 *  web `getUserMedia` path produces, so the food camera does not care which ran. */
export async function nativePhoto() {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 1200,
      correctOrientation: true,
    });
    return photo.dataUrl ?? null;
  } catch {
    // The person cancelled, or denied camera access. Neither is an error.
    return null;
  }
}

/** A short tap on actions that commit something — add to bag, place order. */
export async function tapFeedback(style = "light") {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({
      style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    // Haptics are a nicety; never let them break a log.
  }
}
