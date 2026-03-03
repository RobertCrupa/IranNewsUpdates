import type { TravelAlertData } from "@/lib/types";

interface Props {
  alerts: TravelAlertData[];
}

const levelConfig = {
  green: {
    label: "Safe",
    barClass: "bg-green-500",
    borderClass: "border-green-800",
    badgeClass: "bg-green-900/40 text-green-400",
  },
  yellow: {
    label: "Caution",
    barClass: "bg-yellow-500",
    borderClass: "border-yellow-800",
    badgeClass: "bg-yellow-900/40 text-yellow-400",
  },
  amber: {
    label: "High Risk",
    barClass: "bg-orange-500",
    borderClass: "border-orange-800",
    badgeClass: "bg-orange-900/40 text-orange-400",
  },
  red: {
    label: "Do Not Travel",
    barClass: "bg-red-600",
    borderClass: "border-red-800",
    badgeClass: "bg-red-900/40 text-red-400",
  },
};

const FALLBACK_ALERTS: TravelAlertData[] = [  {
    _id: "fallback-uae",
    country: "United Arab Emirates",
    alertLevel: "yellow",
    title: "Monitor Situation Closely",
    description:
      "The UAE remains relatively stable but is in close proximity to areas of conflict. Airports are operating normally. Monitor official government travel advisories.",
    advice: [
      "Register with your embassy",
      "Keep travel documents accessible",
      "Monitor flight status regularly",
      "Stay away from border regions",
    ],
    embassyContact: "+971 2 414 2200",
    embassyWebsite: "https://ae.usembassy.gov",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "fallback-iran",
    country: "Iran",
    alertLevel: "red",
    title: "Do Not Travel",
    description:
      "The security situation in Iran is extremely dangerous due to armed conflict, civil unrest, and the risk of arbitrary detention. All nationals advised to leave immediately if safe to do so.",
    advice: [
      "Leave immediately if safe to do so",
      "Contact your embassy for evacuation assistance",
      "Avoid all public gatherings and protests",
      "Keep a low profile",
    ],
    embassyContact: "Consular services limited — contact nearest embassy",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "fallback-israel",
    country: "Israel",
    alertLevel: "red",
    title: "Do Not Travel — Active Conflict",
    description:
      "Active conflict ongoing. Rocket and missile attacks are occurring frequently. Borders and airports may be closed or disrupted.",
    advice: [
      "Depart immediately if safe to do so",
      "Follow instructions from local authorities regarding shelters",
      "Stay in designated safe rooms during alerts",
      "Contact your embassy for evacuation options",
    ],
    updatedAt: new Date().toISOString(),
  },
];

export default function TravelInfo({ alerts }: Props) {
  const displayAlerts = alerts.length > 0 ? alerts : FALLBACK_ALERTS;

  return (
    <section id="travel" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Travel Alerts</h2>
        <span className="text-xs text-zinc-500">Affected countries</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {displayAlerts.map((alert) => {
          const config = levelConfig[alert.alertLevel];
          return (
            <div
              key={alert._id}
              className={`relative overflow-hidden rounded-xl border bg-zinc-900 p-5 ${config.borderClass}`}
            >
              <div className={`absolute left-0 top-0 h-1 w-full ${config.barClass}`} />

              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-white">{alert.country}</h3>
                  {alert.city && (
                    <p className="text-xs text-zinc-500">{alert.city}</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}>
                  {config.label}
                </span>
              </div>

              <p className="mb-1 text-sm font-medium text-zinc-200">{alert.title}</p>
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                {alert.description}
              </p>

              {alert.advice.length > 0 && (
                <div className="mb-3">
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Advice
                  </h4>
                  <ul className="space-y-1">
                    {alert.advice.slice(0, 4).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(alert.embassyContact || alert.embassyWebsite) && (
                <div className="border-t border-zinc-800 pt-3">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    Embassy
                  </h4>
                  {alert.embassyContact && (
                    <p className="text-xs text-zinc-400">{alert.embassyContact}</p>
                  )}
                  {alert.embassyWebsite && (
                    <a
                      href={alert.embassyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block text-xs text-blue-400 transition hover:text-blue-300"
                    >
                      Embassy Website ↗
                    </a>
                  )}
                </div>
              )}

              <p className="mt-3 text-right text-xs text-zinc-700">
                Updated{" "}
                {new Date(alert.updatedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
