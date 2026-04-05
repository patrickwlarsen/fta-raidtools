import { settingsStore } from "../../store/SettingsStore";

const SETTINGS_SHEET = "settings";
const SETTINGS_HEADERS = ["Key", "Value"];

function createNumberField(labelText: string, tooltip: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement("label");
  label.className = "settings-label";
  label.textContent = labelText;

  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.className = "settings-input";
  input.placeholder = tooltip;
  input.title = tooltip;

  return { label, input };
}

export function createSettingsPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page settings-page";

  const heading = document.createElement("h2");
  heading.textContent = "Settings";
  page.appendChild(heading);

  // Save button + status right below heading
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn--primary";
  saveBtn.textContent = "Save";

  const status = document.createElement("span");
  status.className = "settings-status";

  const topActions = document.createElement("div");
  topActions.className = "settings-actions";
  topActions.appendChild(saveBtn);
  topActions.appendChild(status);
  page.appendChild(topActions);

  // --- Connection Settings ---
  const connSection = document.createElement("div");
  connSection.className = "settings-section";

  const connHeading = document.createElement("h3");
  connHeading.className = "settings-section-title";
  connHeading.textContent = "Connection";
  connSection.appendChild(connHeading);

  const form = document.createElement("div");
  form.className = "settings-form";

  // Google Sheet URL field
  const urlLabel = document.createElement("label");
  urlLabel.className = "settings-label";
  urlLabel.textContent = "Google Sheet URL";

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "settings-input";
  urlInput.placeholder = "https://docs.google.com/spreadsheets/d/.../edit";

  // Service Account Key field
  const keyLabel = document.createElement("label");
  keyLabel.className = "settings-label";
  keyLabel.textContent = "Service Account Key File";

  const keyRow = document.createElement("div");
  keyRow.className = "settings-key-row";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "settings-input";
  keyInput.readOnly = true;
  keyInput.placeholder = "No key file selected";

  const browseBtn = document.createElement("button");
  browseBtn.className = "btn";
  browseBtn.textContent = "Browse...";
  browseBtn.addEventListener("click", async () => {
    const path = await window.api.selectServiceAccountKey();
    if (path) keyInput.value = path;
  });

  keyRow.appendChild(keyInput);
  keyRow.appendChild(browseBtn);

  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = "Share the Google Sheet with the service account email address (found in the key file as \"client_email\").";

  form.appendChild(urlLabel);
  form.appendChild(urlInput);
  form.appendChild(keyLabel);
  form.appendChild(keyRow);
  form.appendChild(hint);

  connSection.appendChild(form);
  page.appendChild(connSection);

  // --- Roll Modifier Settings ---
  const rollSection = document.createElement("div");
  rollSection.className = "settings-section";

  const rollHeading = document.createElement("h3");
  rollHeading.className = "settings-section-title";
  rollHeading.textContent = "Roll Modifier Settings";
  rollSection.appendChild(rollHeading);

  const rollForm = document.createElement("div");
  rollForm.className = "settings-form";

  const minRollMod = createNumberField("Minimum rollModifier", "0");
  const maxRollMod = createNumberField("Maximum rollModifier", "10");

  rollForm.appendChild(minRollMod.label);
  rollForm.appendChild(minRollMod.input);
  rollForm.appendChild(maxRollMod.label);
  rollForm.appendChild(maxRollMod.input);

  rollSection.appendChild(rollForm);
  page.appendChild(rollSection);

  // Save handler
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await window.api.saveConfig({
        googleSheetUrl: urlInput.value.trim(),
        serviceAccountKeyPath: keyInput.value.trim(),
      });

      const entries = [
        { key: "Minimum rollModifier", value: minRollMod.input.value.trim() },
        { key: "Maximum rollModifier", value: maxRollMod.input.value.trim() },
      ];
      settingsStore.replaceAll(entries);

      const settingsRows = [
        SETTINGS_HEADERS,
        ...entries.map((e) => [e.key, e.value]),
      ];
      await window.api.writeSheet(SETTINGS_SHEET, settingsRows);

      status.textContent = "Saved!";
      setTimeout(() => { status.textContent = ""; }, 2000);
    } catch (err) {
      status.textContent = `Failed to save: ${err instanceof Error ? err.message : err}`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  });

  // Load current config
  window.api.loadConfig().then((config) => {
    urlInput.value = config.googleSheetUrl;
    keyInput.value = config.serviceAccountKeyPath;
  });

  // Populate from store (already preloaded on app start)
  function loadFromStore(): void {
    minRollMod.input.value = settingsStore.get("Minimum rollModifier");
    maxRollMod.input.value = settingsStore.get("Maximum rollModifier");
  }

  loadFromStore();
  settingsStore.subscribe(loadFromStore);

  return page;
}
