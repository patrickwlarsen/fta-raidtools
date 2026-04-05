import { RosterEntry } from "../../models/RosterEntry";
import { AttendanceEntry } from "../../models/AttendanceEntry";
import { RaidSettingsEntry } from "../../models/RaidSettingsEntry";
import { rosterStore } from "../../store/RosterStore";
import { attendanceStore } from "../../store/AttendanceStore";
import { settingsStore } from "../../store/SettingsStore";
import { raidSettingsStore } from "../../store/RaidSettingsStore";

const ROSTER_SHEET = "roster";
const ROSTER_HEADERS = ["Name", "Raid-Helper name", "Rank", "Class", "MS", "OS", "Main", "Profession 1", "Profession 2", "Roll Modifier", "Notes"];
const ATTENDANCE_SHEET = "attendance";
const ATTENDANCE_HEADERS = ["Date", "Event Name", "Link", "Roster"];

function findRosterName(signUpName: string): string {
  const roster = rosterStore.getAll();
  const lower = signUpName.toLowerCase();

  // First check raidHelperName
  const byRaidHelper = roster.find((r) => r.raidHelperName.toLowerCase() === lower);
  if (byRaidHelper) return byRaidHelper.name;

  // Then check character name
  const byName = roster.find((r) => r.name.toLowerCase() === lower);
  if (byName) return byName.name;

  return "";
}

function extractEventId(input: string): string | null {
  const trimmed = input.trim();

  // Match: https://raid-helper.dev/api/v2/events/<id> or .xyz
  const apiMatch = trimmed.match(/raid-helper\.(?:dev|xyz)\/api\/v2\/events\/(\d+)/);
  if (apiMatch) return apiMatch[1];

  // Match: https://raid-helper.dev/event/<id> or .xyz
  const eventMatch = trimmed.match(/raid-helper\.(?:dev|xyz)\/event\/(\d+)/);
  if (eventMatch) return eventMatch[1];

  return null;
}

function roleSort(roleName: string | undefined): number {
  switch (roleName) {
    case "Tanks": return 0;
    case "Healers": return 1;
    case "Melee": return 2;
    case "Ranged": return 3;
    default: return 4;
  }
}

function showUrlPrompt(onSubmit: (eventId: string, raidSettings: RaidSettingsEntry) => void): void {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";

  const title = document.createElement("h3");
  title.className = "modal__title";
  title.textContent = "New Attendance Entry";
  modal.appendChild(title);

  /* ── Raid dropdown ── */
  const raidField = document.createElement("div");
  raidField.className = "modal__field";

  const raidLabel = document.createElement("label");
  raidLabel.className = "modal__label";
  raidLabel.textContent = "Raid";

  const raidSelect = document.createElement("select");
  raidSelect.className = "modal__input";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Choose raid";
  defaultOpt.disabled = true;
  defaultOpt.selected = true;
  raidSelect.appendChild(defaultOpt);

  const raids = raidSettingsStore.getAll();
  for (const raid of raids) {
    const opt = document.createElement("option");
    opt.value = raid.id;
    opt.textContent = raid.name;
    raidSelect.appendChild(opt);
  }

  const raidError = document.createElement("div");
  raidError.className = "modal__error";
  raidError.style.display = "none";
  raidError.textContent = "Please select a raid.";

  raidSelect.addEventListener("change", () => {
    raidError.style.display = "none";
  });

  raidField.appendChild(raidLabel);
  raidField.appendChild(raidSelect);
  raidField.appendChild(raidError);
  modal.appendChild(raidField);

  /* ── URL field ── */
  const field = document.createElement("div");
  field.className = "modal__field";

  const label = document.createElement("label");
  label.className = "modal__label";
  label.textContent = "Raid Helper Event URL";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "modal__input";
  input.placeholder = "https://raid-helper.dev/event/...";

  const error = document.createElement("div");
  error.className = "attendance-url-error";
  error.style.display = "none";
  error.textContent = "Invalid URL. Use a raid-helper.dev or raid-helper.xyz event or API URL.";

  field.appendChild(label);
  field.appendChild(input);
  field.appendChild(error);
  modal.appendChild(field);

  const actions = document.createElement("div");
  actions.className = "modal__actions";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.textContent = "Load Event";
  submitBtn.addEventListener("click", () => {
    if (!raidSelect.value) {
      raidError.style.display = "block";
      raidSelect.focus();
      return;
    }
    const eventId = extractEventId(input.value);
    if (!eventId) {
      error.style.display = "block";
      input.focus();
      return;
    }
    const selectedRaid = raids.find((r) => r.id === raidSelect.value);
    if (!selectedRaid) return;
    overlay.remove();
    onSubmit(eventId, selectedRaid);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitBtn.click();
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => overlay.remove());

  actions.appendChild(submitBtn);
  actions.appendChild(cancelBtn);
  modal.appendChild(actions);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
  raidSelect.focus();
}

function buildAttendanceForm(event: RaidHelperEvent, eventId: string, raidSettings: RaidSettingsEntry): HTMLElement {
  const container = document.createElement("div");
  container.className = "attendance-form";

  // Event header
  const header = document.createElement("div");
  header.className = "attendance-header";

  const titleEl = document.createElement("h2");
  titleEl.className = "attendance-event-title";
  titleEl.textContent = event.title;

  const meta = document.createElement("div");
  meta.className = "attendance-meta";
  meta.textContent = `Date: ${event.date} | Time: ${event.time} | Leader: ${event.leaderName}`;

  header.appendChild(titleEl);
  header.appendChild(meta);
  container.appendChild(header);

  // Filter out absences and sort by role
  const attendees = event.signUps
    .filter((s) => s.className !== "Absence")
    .sort((a, b) => roleSort(a.roleName) - roleSort(b.roleName));

  const absences = event.signUps.filter((s) => s.className === "Absence");

  // Attendee list
  const list = document.createElement("div");
  list.className = "attendance-list";

  const listHeader = document.createElement("div");
  listHeader.className = "attendance-row attendance-row--header";
  listHeader.innerHTML =
    `<span class="attendance-col attendance-col--name">Name</span>` +
    `<span class="attendance-col attendance-col--class">Class</span>` +
    `<span class="attendance-col attendance-col--spec">Spec</span>` +
    `<span class="attendance-col attendance-col--role">Role</span>` +
    `<span class="attendance-col attendance-col--points">Award</span>` +
    `<span class="attendance-col attendance-col--award">Award to</span>` +
    `<span class="attendance-col attendance-col--check">Attended</span>`;
  list.appendChild(listHeader);

  attendees.forEach((signUp) => {
    const row = document.createElement("label");
    row.className = "attendance-row";

    const name = document.createElement("span");
    name.className = "attendance-col attendance-col--name";
    name.textContent = signUp.name;

    const cls = document.createElement("span");
    cls.className = "attendance-col attendance-col--class";
    cls.textContent = signUp.className ?? "";

    const spec = document.createElement("span");
    spec.className = "attendance-col attendance-col--spec";
    spec.textContent = signUp.specName ?? "";

    const role = document.createElement("span");
    role.className = "attendance-col attendance-col--role";
    role.textContent = signUp.roleName ?? "";

    const pointsWrap = document.createElement("span");
    pointsWrap.className = "attendance-col attendance-col--points";
    const pointsInput = document.createElement("input");
    pointsInput.type = "text";
    pointsInput.className = "attendance-points-input";
    pointsInput.value = raidSettings.awardForCompletion || "0";
    pointsInput.addEventListener("click", (e) => e.preventDefault());
    pointsWrap.appendChild(pointsInput);

    const awardWrap = document.createElement("span");
    awardWrap.className = "attendance-col attendance-col--award";
    const awardInput = document.createElement("input");
    awardInput.type = "text";
    awardInput.className = "attendance-award-input";
    awardInput.value = findRosterName(signUp.name);
    awardInput.addEventListener("click", (e) => e.preventDefault());
    awardWrap.appendChild(awardInput);

    const checkWrap = document.createElement("span");
    checkWrap.className = "attendance-col attendance-col--check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.className = "attendance-checkbox";
    checkbox.dataset.userId = signUp.userId;
    checkbox.dataset.name = signUp.name;
    checkWrap.appendChild(checkbox);

    row.appendChild(name);
    row.appendChild(cls);
    row.appendChild(spec);
    row.appendChild(role);
    row.appendChild(pointsWrap);
    row.appendChild(awardWrap);
    row.appendChild(checkWrap);
    list.appendChild(row);
  });

  container.appendChild(list);

  // Show absences section
  if (absences.length > 0) {
    const absSection = document.createElement("div");
    absSection.className = "attendance-absences";

    const absTitle = document.createElement("h3");
    absTitle.className = "attendance-absences-title";
    absTitle.textContent = `Absences (${absences.length})`;
    absSection.appendChild(absTitle);

    const absNames = document.createElement("div");
    absNames.className = "attendance-absences-list";
    absNames.textContent = absences.map((s) => s.name).join(", ");
    absSection.appendChild(absNames);

    container.appendChild(absSection);
  }

  // Build set of all roster names that participated in the event (attendees + absences)
  const allSignUpNames = new Set<string>();
  for (const s of event.signUps) {
    const rosterName = findRosterName(s.name);
    if (rosterName) allSignUpNames.add(rosterName.toLowerCase());
  }

  // Find roster members who did not sign up at all
  const roster = rosterStore.getAll();
  const notSignedUp = roster.filter((r) => r.name && !allSignUpNames.has(r.name.toLowerCase()));

  // "Did not sign up" section
  const dnsSection = document.createElement("div");
  dnsSection.className = "attendance-absences";

  const dnsTitle = document.createElement("h3");
  dnsTitle.className = "attendance-absences-title";
  dnsTitle.textContent = `Did not sign up (${notSignedUp.length})`;
  dnsSection.appendChild(dnsTitle);

  const dnsList = document.createElement("div");
  dnsList.className = "attendance-list";

  const dnsHeader = document.createElement("div");
  dnsHeader.className = "attendance-row attendance-row--header";
  dnsHeader.innerHTML =
    `<span class="attendance-col attendance-col--name">Name</span>` +
    `<span class="attendance-col attendance-col--points">Deduction</span>` +
    `<span class="attendance-col attendance-col--check">Apply</span>`;
  dnsList.appendChild(dnsHeader);

  const didNotSignUpDeduction = raidSettings.didNotSignUp || "0";

  for (const member of notSignedUp) {
    const row = document.createElement("label");
    row.className = "attendance-row attendance-row--dns";

    const nameCol = document.createElement("span");
    nameCol.className = "attendance-col attendance-col--name";
    nameCol.textContent = member.name;

    const deductWrap = document.createElement("span");
    deductWrap.className = "attendance-col attendance-col--points";
    const deductInput = document.createElement("input");
    deductInput.type = "text";
    deductInput.className = "attendance-points-input";
    deductInput.value = `-${didNotSignUpDeduction}`;
    deductInput.addEventListener("click", (e) => e.preventDefault());
    deductWrap.appendChild(deductInput);

    const checkWrap = document.createElement("span");
    checkWrap.className = "attendance-col attendance-col--check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.className = "attendance-dns-checkbox";
    checkbox.dataset.rosterName = member.name;
    checkWrap.appendChild(checkbox);

    row.appendChild(nameCol);
    row.appendChild(deductWrap);
    row.appendChild(checkWrap);
    dnsList.appendChild(row);
  }

  dnsSection.appendChild(dnsList);
  container.appendChild(dnsSection);

  // Footer with spinner and confirm button
  const footer = document.createElement("div");
  footer.className = "attendance-footer";

  const footerSpinner = document.createElement("div");
  footerSpinner.className = "attendance-footer-spinner";
  footerSpinner.style.display = "none";
  footerSpinner.innerHTML = '<div class="spinner"></div>';
  footer.appendChild(footerSpinner);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn btn--primary";
  confirmBtn.textContent = "Confirm & Award";
  confirmBtn.addEventListener("click", async () => {
    confirmBtn.disabled = true;
    footerSpinner.style.display = "flex";

    try {
      await confirmAndAward(list, dnsList, event, eventId);
    } finally {
      confirmBtn.disabled = false;
      footerSpinner.style.display = "none";
    }
  });
  footer.appendChild(confirmBtn);

  container.appendChild(footer);

  return container;
}

async function confirmAndAward(list: HTMLElement, dnsList: HTMLElement, event: RaidHelperEvent, eventId: string): Promise<void> {
  const roster = rosterStore.getAll();
  const rosterByName = new Map<string, RosterEntry>();
  for (const entry of roster) {
    rosterByName.set(entry.name.toLowerCase(), entry);
  }

  const notFound: string[] = [];
  const rows = Array.from(list.querySelectorAll(".attendance-row:not(.attendance-row--header)"));

  for (const row of rows) {
    const checkbox = row.querySelector(".attendance-checkbox") as HTMLInputElement | null;
    if (!checkbox?.checked) continue;

    const awardToInput = row.querySelector(".attendance-award-input") as HTMLInputElement | null;
    const pointsInput = row.querySelector(".attendance-points-input") as HTMLInputElement | null;
    const awardTo = awardToInput?.value.trim() ?? "";
    const points = parseFloat(pointsInput?.value ?? "0") || 0;

    if (!awardTo) {
      const signUpName = row.querySelector(".attendance-col--name")?.textContent ?? "Unknown";
      notFound.push(signUpName);
      continue;
    }

    const rosterEntry = rosterByName.get(awardTo.toLowerCase());
    if (!rosterEntry) {
      notFound.push(awardTo);
      continue;
    }

    const currentMod = parseFloat(rosterEntry.rollModifier) || 0;
    let newMod = parseFloat((currentMod + points).toFixed(4));
    const maxRollMod = parseFloat(settingsStore.get("Maximum rollModifier"));
    if (!isNaN(maxRollMod) && newMod > maxRollMod) {
      newMod = maxRollMod;
    }
    rosterEntry.rollModifier = String(newMod);
  }

  // Apply "did not sign up" deductions
  const dnsRows = Array.from(dnsList.querySelectorAll(".attendance-row--dns"));
  for (const row of dnsRows) {
    const checkbox = row.querySelector(".attendance-dns-checkbox") as HTMLInputElement | null;
    if (!checkbox?.checked) continue;

    const rosterName = checkbox.dataset.rosterName ?? "";
    const pointsInput = row.querySelector(".attendance-points-input") as HTMLInputElement | null;
    const deduction = parseFloat(pointsInput?.value ?? "0") || 0;

    const rosterEntry = rosterByName.get(rosterName.toLowerCase());
    if (!rosterEntry) continue;

    const currentMod = parseFloat(rosterEntry.rollModifier) || 0;
    let newMod = parseFloat((currentMod + deduction).toFixed(4));
    const minRollMod = parseFloat(settingsStore.get("Minimum rollModifier"));
    if (!isNaN(minRollMod) && newMod < minRollMod) {
      newMod = minRollMod;
    }
    rosterEntry.rollModifier = String(newMod);
  }

  // Save updated roster
  rosterStore.replaceAll(roster);
  const rosterRows = roster.map((e) => [
    e.name, e.raidHelperName, e.rank, e.class, e.ms, e.os, e.main, e.profession1, e.profession2, e.rollModifier, e.notes,
  ]);
  await window.api.writeSheet(ROSTER_SHEET, [ROSTER_HEADERS, ...rosterRows]);

  // Save attendance entry
  const link = `https://raid-helper.dev/event/${eventId}`;
  const attendanceEntry: AttendanceEntry = {
    date: event.date,
    eventName: event.title,
    link,
    roster: JSON.stringify(event),
  };
  attendanceStore.add(attendanceEntry);

  const allEntries = attendanceStore.getAll();
  const attendanceRows = allEntries.map((e) => [e.date, e.eventName, e.link, e.roster]);
  await window.api.writeSheet(ATTENDANCE_SHEET, [ATTENDANCE_HEADERS, ...attendanceRows]);

  // Show result
  if (notFound.length > 0) {
    alert(
      `Awards saved, but the following names were not found in the roster:\n\n` +
      notFound.map((n) => `  - ${n}`).join("\n")
    );
  } else {
    alert("All attendance awards have been applied and saved.");
  }
}

function buildHistoryList(container: HTMLElement): void {
  container.innerHTML = "";

  const entries = attendanceStore.getAll();
  if (entries.length === 0) return;

  const title = document.createElement("h3");
  title.className = "attendance-history-title";
  title.textContent = "Previous Events";
  container.appendChild(title);

  const table = document.createElement("div");
  table.className = "attendance-history";

  const header = document.createElement("div");
  header.className = "attendance-history-row attendance-history-row--header";
  header.innerHTML =
    `<span class="attendance-history-col attendance-history-col--date">Date</span>` +
    `<span class="attendance-history-col attendance-history-col--name">Event Name</span>` +
    `<span class="attendance-history-col attendance-history-col--link">Link</span>`;
  table.appendChild(header);

  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "attendance-history-row";

    const date = document.createElement("span");
    date.className = "attendance-history-col attendance-history-col--date";
    date.textContent = entry.date;

    const name = document.createElement("span");
    name.className = "attendance-history-col attendance-history-col--name";
    name.textContent = entry.eventName;

    const linkCol = document.createElement("span");
    linkCol.className = "attendance-history-col attendance-history-col--link";
    const anchor = document.createElement("a");
    anchor.href = entry.link;
    anchor.textContent = entry.link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(entry.link, "_blank");
    });
    linkCol.appendChild(anchor);

    row.appendChild(date);
    row.appendChild(name);
    row.appendChild(linkCol);
    table.appendChild(row);
  }

  container.appendChild(table);
}

export function createAttendancePage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page attendance-page";

  const toolbar = document.createElement("div");
  toolbar.className = "loot-history-toolbar";

  const newEntryBtn = document.createElement("button");
  newEntryBtn.className = "btn btn--primary";
  newEntryBtn.textContent = "New Entry";

  toolbar.appendChild(newEntryBtn);
  page.appendChild(toolbar);

  const content = document.createElement("div");
  content.className = "attendance-content";
  page.appendChild(content);

  const historyContainer = document.createElement("div");
  historyContainer.className = "attendance-history-container";
  page.appendChild(historyContainer);

  // Render history list and subscribe for updates
  buildHistoryList(historyContainer);
  attendanceStore.subscribe(() => buildHistoryList(historyContainer));

  newEntryBtn.addEventListener("click", () => {
    showUrlPrompt(async (eventId, raidSettings) => {
      content.innerHTML = "";

      const spinner = document.createElement("div");
      spinner.className = "attendance-loading";
      spinner.innerHTML = '<div class="spinner"></div><span>Loading event data...</span>';
      content.appendChild(spinner);

      try {
        const event = await window.api.fetchRaidHelperEvent(eventId);
        content.innerHTML = "";
        content.appendChild(buildAttendanceForm(event, eventId, raidSettings));
      } catch (err) {
        content.innerHTML = "";
        const errEl = document.createElement("div");
        errEl.className = "attendance-error";
        errEl.textContent = `Failed to load event: ${err instanceof Error ? err.message : err}`;
        content.appendChild(errEl);
      }
    });
  });

  return page;
}
