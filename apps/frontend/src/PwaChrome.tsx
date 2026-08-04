import InstallRondoBanner from './InstallRondoBanner';
import IosInstallGuide from './IosInstallGuide';
import OfflineBanner from './OfflineBanner';
import UpdatePrompt from './UpdatePrompt';

/**
 * Every always-mounted PWA overlay in one place, rendered once alongside
 * <App /> in main.tsx (outside it, so these work even on the pre-login
 * screen): the offline strip, the update prompt, and whichever install nudge
 * applies to this device. Each piece decides its own visibility -- this is
 * just a mount point, not a coordinator.
 */
function PwaChrome() {
  return (
    <>
      <OfflineBanner />
      <UpdatePrompt />
      <InstallRondoBanner />
      <IosInstallGuide />
    </>
  );
}

export default PwaChrome;
