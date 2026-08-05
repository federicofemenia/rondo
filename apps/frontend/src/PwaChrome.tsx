import OfflineBanner from './OfflineBanner';
import UpdatePrompt from './UpdatePrompt';

/**
 * Always-mounted, pre-login-safe PWA overlays, rendered once alongside
 * <App /> in main.tsx (outside it, so these work even on the Login screen):
 * the offline strip and the update prompt. The install nudge
 * (InstallWelcomeDialog) is deliberately NOT here -- it only makes sense
 * once authenticated ("primer ingreso"), so App.tsx mounts it itself,
 * gated on isSignedIn. Each piece here decides its own visibility -- this
 * is just a mount point, not a coordinator.
 */
function PwaChrome() {
  return (
    <>
      <OfflineBanner />
      <UpdatePrompt />
    </>
  );
}

export default PwaChrome;
