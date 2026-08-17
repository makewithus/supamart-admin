import React, { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAudioContext, isAudioUnlocked, playNotificationSound } from '../utils/notificationSound';
import { initPushNotifications, getPushDiagnostics } from '../services/pushNotifications';

// Section 5's explicit requirement: browsers won't autoplay audio (or, generally, prompt
// for Notification permission) without a real user gesture. This is that one gesture,
// requested once. Clicking "Enable Order Alerts":
//   1. Creates/resumes the AudioContext synchronously inside the click handler — the only
//      way resume() actually succeeds instead of silently staying 'suspended'.
//   2. Plays the real chime immediately, so the click doubles as the "Test Alert Sound"
//      confirmation the admin can actually hear.
//   3. Requests Notification permission and registers the FCM token for background/other-
//      tab pushes (best-effort — foreground alerts already work without this).
export default function EnableAlertsPrompt({ show, onEnabled, onDismiss }) {
  const [busy, setBusy] = useState(false);

  if (!show) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      // Step 1+2, inside this click's call stack — this is the audio unlock.
      const ctx = getAudioContext();
      ctx?.resume();
      playNotificationSound();

      // Step 3 — explicit permission request (requestPermission: true), also inside the
      // gesture. Logged with the exact reason on any non-success path (see
      // pushNotifications.js) rather than swallowed.
      const result = await initPushNotifications({ requestPermission: true });

      // Every branch here is what the admin actually sees — kept short and free of any
      // internal/technical detail (VAPID keys, "see console", reason codes). The full
      // diagnostic reason is already logged to the console by initPushNotifications()
      // itself, which is where that detail belongs, not in a toast a shop admin reads.
      if (isAudioUnlocked()) {
        if (result.ok || result.reason === 'no-vapid-key') {
          // "no-vapid-key" means only the background-push layer isn't configured yet —
          // from the admin's side that's indistinguishable from full success: sound
          // alerts (the core requirement) work fully either way.
          toast.success('Order alerts enabled');
        } else if (result.reason === 'permission-denied') {
          toast.success('Order alerts enabled for this tab. Turn on notifications in your browser settings to also get alerts when the tab is in the background.');
        } else {
          toast.success('Order alerts enabled');
        }
      } else {
        toast.error("Couldn't enable order alerts. Please try again.");
      }
      onEnabled();
    } finally {
      setBusy(false);
    }
  };

  const diagnostics = getPushDiagnostics();
  const permissionDenied = diagnostics.permission === 'denied';

  return (
    <div className="sticky top-0 z-40 px-4 sm:px-6 lg:px-8 pt-4 animate-fade-in">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <BellRing size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary-900">Enable order alerts</p>
          <p className="text-xs text-neutral-500">
            {permissionDenied
              ? 'Notifications are blocked for this site — sound alerts still work while this tab is open. Enable notifications from your browser\'s site settings for background alerts too.'
              : 'Turn on sound + browser notifications for new orders — required once per browser/device.'}
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="px-4 py-2 rounded-xl bg-primary-900 text-white text-sm font-bold hover:bg-primary-800 transition-colors disabled:opacity-60 flex-shrink-0"
        >
          {busy ? 'Enabling…' : 'Enable Order Alerts'}
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-black/5 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
