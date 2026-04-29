import React, { useState } from "react";

export type OverrideSource = "env" | "overrides" | "default";

export interface RuntimeOverrideField {
  value: number;
  source: OverrideSource;
  editable: boolean;
  defaultValue: number;
  envVar?: string;
}

export interface RuntimeOverridesValues {
  sunoDailyBudget: RuntimeOverrideField;
  birdDailyMax: RuntimeOverrideField;
  birdMinIntervalMinutes: RuntimeOverrideField;
  autopilotIntervalMinutes: RuntimeOverrideField;
}

export interface RuntimeOverridesSavePayload {
  suno?: { dailyBudget?: number };
  bird?: { rateLimits?: { dailyMax?: number; minIntervalMinutes?: number } };
  autopilot?: { intervalMinutes?: number };
}

export interface SettingsRuntimeOverridesPanelProps {
  values?: RuntimeOverridesValues;
  dryRun?: boolean;
  liveGoArmed?: boolean;
  busy: boolean;
  onSave: (payload: RuntimeOverridesSavePayload) => Promise<void> | void;
}

function sourceLabel(field: RuntimeOverrideField): string {
  if (field.source === "env") {
    return `source: env ${field.envVar ?? ""}`.trim();
  }
  if (field.source === "overrides") {
    return "source: runtime override";
  }
  return `source: default ${field.defaultValue}`;
}

export function buildRuntimeOverridesSavePayload(values: RuntimeOverridesValues, draft: Record<keyof RuntimeOverridesValues, string>): RuntimeOverridesSavePayload {
  const parsed = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, Number(value)])
  ) as Record<keyof RuntimeOverridesValues, number>;
  return {
    ...(!values.sunoDailyBudget.editable ? {} : { suno: { dailyBudget: parsed.sunoDailyBudget } }),
    ...(!values.birdDailyMax.editable && !values.birdMinIntervalMinutes.editable
      ? {}
      : {
          bird: {
            rateLimits: {
              ...(!values.birdDailyMax.editable ? {} : { dailyMax: parsed.birdDailyMax }),
              ...(!values.birdMinIntervalMinutes.editable ? {} : { minIntervalMinutes: parsed.birdMinIntervalMinutes })
            }
          }
        }),
    ...(!values.autopilotIntervalMinutes.editable ? {} : { autopilot: { intervalMinutes: parsed.autopilotIntervalMinutes } })
  };
}

export async function submitRuntimeOverrides(
  onSave: SettingsRuntimeOverridesPanelProps["onSave"],
  values: RuntimeOverridesValues,
  draft: Record<keyof RuntimeOverridesValues, string>
): Promise<void> {
  await onSave(buildRuntimeOverridesSavePayload(values, draft));
}

function initialDraft(values: RuntimeOverridesValues): Record<keyof RuntimeOverridesValues, string> {
  return {
    sunoDailyBudget: String(values.sunoDailyBudget.value),
    birdDailyMax: String(values.birdDailyMax.value),
    birdMinIntervalMinutes: String(values.birdMinIntervalMinutes.value),
    autopilotIntervalMinutes: String(values.autopilotIntervalMinutes.value)
  };
}

function FieldInput(props: {
  id: keyof RuntimeOverridesValues;
  label: string;
  field: RuntimeOverrideField;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <div className="eyebrow">{props.label}</div>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        disabled={!props.field.editable}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className="muted">{sourceLabel(props.field)}</div>
      {!props.field.editable ? <div className="warning-banner">Environment override is active; UI writes will not change this value.</div> : null}
    </label>
  );
}

export function SettingsRuntimeOverridesPanel(props: SettingsRuntimeOverridesPanelProps) {
  const values = props.values;
  const [draft, setDraft] = useState<Record<keyof RuntimeOverridesValues, string> | null>(values ? initialDraft(values) : null);

  if (!values) {
    return (
      <article className="panel runtime-overrides-panel">
        <div className="section-title">Runtime Safety Settings</div>
        <div className="item muted">Loading runtime override settings.</div>
      </article>
    );
  }

  const currentDraft = draft ?? initialDraft(values);
  const updateDraft = (key: keyof RuntimeOverridesValues, value: string) => {
    setDraft((current) => ({ ...(current ?? initialDraft(values)), [key]: value }));
  };

  return (
    <article className="panel runtime-overrides-panel">
      <div className="section-title">Runtime Safety Settings</div>
      <div className="config-form">
        <div className="field-grid">
          <FieldInput id="sunoDailyBudget" label="Suno daily budget" field={values.sunoDailyBudget} value={currentDraft.sunoDailyBudget} min={1} max={1000} onChange={(value) => updateDraft("sunoDailyBudget", value)} />
          <FieldInput id="birdDailyMax" label="Bird daily max calls" field={values.birdDailyMax} value={currentDraft.birdDailyMax} min={1} max={100} onChange={(value) => updateDraft("birdDailyMax", value)} />
          <FieldInput id="birdMinIntervalMinutes" label="Bird min interval minutes" field={values.birdMinIntervalMinutes} value={currentDraft.birdMinIntervalMinutes} min={1} max={1440} onChange={(value) => updateDraft("birdMinIntervalMinutes", value)} />
          <FieldInput id="autopilotIntervalMinutes" label="Autopilot interval minutes" field={values.autopilotIntervalMinutes} value={currentDraft.autopilotIntervalMinutes} min={15} max={1440} onChange={(value) => updateDraft("autopilotIntervalMinutes", value)} />
        </div>
        <div className="item">
          <div className="eyebrow">Live safety posture</div>
          <div className="muted">dryRun: {props.dryRun === false ? "off" : "on"} · liveGoArmed: {props.liveGoArmed ? "armed" : "held"}</div>
          <div className="muted">Publish arms stay read-only here. Use the Telegram multi-confirmation path for live arm changes.</div>
        </div>
        <div className="inline-actions">
          <button className="primary" disabled={props.busy} onClick={() => void submitRuntimeOverrides(props.onSave, values, currentDraft)}>Save runtime settings</button>
        </div>
      </div>
    </article>
  );
}
