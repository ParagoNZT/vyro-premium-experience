import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Monitor } from "lucide-react";
import {
  AccountActivation,
  AccountDeviceCount,
  AccountDevices,
  AccountHero,
} from "@/components/site/AccountDevices";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account/appareils")({
  head: () => ({
    meta: [{ title: "Mes appareils – VYRO Premium" }, { name: "robots", content: "noindex" }],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { user } = useAuth();
  const count = user?.devices.length ?? 0;
  const limit = user?.subscription?.devicesAllowed;

  return (
    <div className="account-page">
      <AccountHero
        label="Gestion des appareils"
        title="Mes appareils"
        action={
          <a href="#activation-tv" className="account-button account-button-on-dark">
            Comment activer un appareil <ArrowDown size={16} aria-hidden />
          </a>
        }
        summary={
          <>
            <div className="account-summary-heading">
              <span className="account-eyebrow">Votre licence</span>
              <Monitor size={20} aria-hidden />
            </div>
            <strong className="account-summary-number">
              <AccountDeviceCount count={count} limit={limit} />
            </strong>
            <p className="account-summary-days">Appareils activés sur la licence</p>
          </>
        }
      >
        Retrouvez vos appareils associés par QR code et ceux activés sur votre licence.
      </AccountHero>
      <AccountDevices />
      <AccountActivation />
    </div>
  );
}
