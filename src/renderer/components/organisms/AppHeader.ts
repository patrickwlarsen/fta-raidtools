import { createNavMenu } from "../molecules/NavMenu";
import { NavLinkOptions, NavCallback } from "../atoms/NavLink";

const navItems: NavLinkOptions[] = [
  { label: "Loot History", href: "#loot-history", active: true },
  { label: "Roster", href: "#roster" },
  { label: "Attendance", href: "#attendance" },
  { label: "Settings", href: "#settings" },
];

export function createAppHeader(onNavigate?: NavCallback): HTMLElement {
  const header = document.createElement("header");
  header.className = "app-header";

  const title = document.createElement("h1");
  title.className = "app-header__title";
  title.textContent = "FTA Raid Tools";

  header.appendChild(title);
  header.appendChild(createNavMenu(navItems, onNavigate));

  return header;
}
