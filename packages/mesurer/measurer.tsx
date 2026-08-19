"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ensureMeasurerStyles } from "./runtime/style-inject";
import { MESURER_STYLES } from "./styles.generated";
import { Toolbar } from "./components/toolbar";
import { ColorPicker } from "./components/color-picker";
import { RulersOverlay } from "./components/rulers-overlay";
import type { SettingsTab } from "./components/settings-panel";
import { useColorPicker } from "./hooks/use-color-picker";
import { useDragState } from "./hooks/use-drag-state";
import { useGuideDragHold } from "./hooks/use-guide-drag-hold";
import { useGuideState } from "./hooks/use-guide-state";
import { useGuideWindowEvents } from "./hooks/use-guide-window-events";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useHydrated } from "./hooks/use-hydrated";
import { useLiveElementTracking } from "./hooks/use-live-element-tracking";
import { useMeasureToggles } from "./hooks/use-measure-toggles";
import { useMeasurementState } from "./hooks/use-measurement-state";
import { useMeasurerDerived } from "./hooks/use-measurer-derived";
import { useMeasurerHistory } from "./hooks/use-measurer-history";
import { useMeasurerLocalState } from "./hooks/use-measurer-local-state";
import { useMeasurerPointer } from "./hooks/use-measurer-pointer";
import { useOverlayRefs } from "./hooks/use-overlay-refs";
import { useResizeSync } from "./hooks/use-resize-sync";
import { useRulerGuides } from "./hooks/use-ruler-guides";
import { useScreenshot } from "./hooks/use-screenshot";
import { useSelectionAnimationCleanup } from "./hooks/use-selection-animation-cleanup";
import { useTextInspector } from "./hooks/use-text-inspector";
import { useToolbarIdle } from "./hooks/use-toolbar-idle";
import { useXray } from "./hooks/use-xray";
import { MeasurerOverlay } from "./render/measurer-overlay";
import { settingsTabForContext } from "./core/settings-tab";
import type {
  DistanceOverlay,
  Guide,
  Measurement,
  Rect,
  ToolMode,
} from "./core/types";
import type { ColorPickerFormat } from "./core/colors";
import { ScreenshotSelectOverlay } from "./components/screenshot-select-overlay";
import {
  createLocalStoragePersistence,
  DEFAULT_GUIDE_STYLE,
  type MesurerPersistence,
  type MesurerPersistenceSnapshot,
  type PersistenceChangeSource,
  type MesurerStoredWorkspace,
  type GuideStyle,
  DEFAULT_RULER_SETTINGS,
  DEFAULT_SCREENSHOT_SETTINGS,
  type RulerSettings,
  type ScreenshotSettings,
} from "./core/persistence";
import {
  getTabId,
  LEGACY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  sanitizeStoredSettings,
  stripDistance,
  stripMeasurement,
} from "./core/workspace";

export type MeasurerProps = {
  highlightColor?: string;
  guideColor?: string;
  hoverHighlightEnabled?: boolean;
  persistOnReload?: boolean;
  portalTarget?: HTMLElement | ShadowRoot;
  persistKey?: string;
  colorPickerFormats?: ColorPickerFormat[];
  colorPickerClickFormat?: ColorPickerFormat;
  snapEnabled?: boolean;
  snapGuidesEnabled?: boolean;
  selectNewGuideEnabled?: boolean;
  multiMeasureEnabled?: boolean;
  guideStyle?: Partial<GuideStyle>;
  rulerSettings?: Partial<RulerSettings>;
  persistence?: MesurerPersistence;
  onPersistenceError?: (error: unknown) => void;
  captureVisibleTab?: () => Promise<Blob>;
};

let measurerInstanceCount = 0;

function MeasurerClient({
  highlightColor,
  guideColor,
  hoverHighlightEnabled,
  persistOnReload,
  portalTarget,
  persistKey,
  colorPickerFormats,
  colorPickerClickFormat,
  snapEnabled: snapEnabledDefault,
  snapGuidesEnabled: snapGuidesEnabledDefault,
  selectNewGuideEnabled: selectNewGuideEnabledDefault,
  multiMeasureEnabled: multiMeasureEnabledDefault,
  guideStyle: guideStyleDefault,
  rulerSettings: rulerSettingsDefault,
  persistence,
  onPersistenceError,
  captureVisibleTab,
}: Required<
  Omit<
    MeasurerProps,
    | "persistKey"
    | "persistence"
    | "onPersistenceError"
    | "guideStyle"
    | "rulerSettings"
    | "captureVisibleTab"
  >
> &
  Pick<
    MeasurerProps,
    "persistKey" | "persistence" | "onPersistenceError" | "captureVisibleTab"
  > & {
    guideStyle: GuideStyle;
    rulerSettings: RulerSettings;
  }) {
  const instanceIdRef = useRef<number | null>(null);
  if (instanceIdRef.current === null) {
    instanceIdRef.current = ++measurerInstanceCount;
  }
  const ownerDocument = portalTarget.ownerDocument ?? document;
  const ownerWindow = ownerDocument.defaultView ?? window;
  const tabIdRef = useRef<string | null>(null);
  if (tabIdRef.current === null) tabIdRef.current = getTabId(ownerWindow);
  const storageKey =
    persistKey ??
    (instanceIdRef.current === 1
      ? `mesurer-state:${tabIdRef.current}`
      : `mesurer-state:${tabIdRef.current}:${instanceIdRef.current}`);
  const legacyStorageKey = persistKey ? undefined : LEGACY_STORAGE_KEY;
  const selectionRectRef = useRef<Rect | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const persistenceErrorHandlerRef = useRef(onPersistenceError);
  persistenceErrorHandlerRef.current = onPersistenceError;
  const activePersistence = useMemo(() => {
    const next = persistence ?? createLocalStoragePersistence(ownerWindow, storageKey, SETTINGS_STORAGE_KEY, legacyStorageKey);
    next.setErrorHandler?.((error) => persistenceErrorHandlerRef.current?.(error));
    return next;
  }, [legacyStorageKey, ownerWindow, persistence, storageKey]);
  const storedState = useMemo(
    () => activePersistence.load(),
    [activePersistence],
  );
  const persistedState =
    persistOnReload || storedState?.settings.persistOnReload
      ? storedState?.workspace ?? null
      : null;
  const persistedSettings = sanitizeStoredSettings(ownerWindow, storedState?.settings ?? {});

  useEffect(() => {
    return () => activePersistence.setErrorHandler?.(undefined);
  }, [activePersistence]);

  const enabledRef = useRef(false);
  const toolModeRef = useRef<ToolMode>(
    persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode ?? "none",
  );
  const rulersVisibleRef = useRef(
    persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
  );
  const xrayVisibleRef = useRef(persistedState?.xrayVisible ?? persistedState?.toolMode === "xray");
  const guideOrientationRef = useRef<"vertical" | "horizontal">(
    persistedState?.guideOrientation ?? "vertical",
  );
  const measurementsRef = useRef<Measurement[]>(
    persistedState?.measurements ?? [],
  );
  const activeMeasurementRef = useRef<Measurement | null>(
    persistedState?.activeMeasurement ?? null,
  );
  const heldDistancesRef = useRef<DistanceOverlay[]>(
    persistedState?.heldDistances ?? [],
  );
  const guidesRef = useRef<Guide[]>(persistedState?.guides ?? []);
  const selectedGuideIdsRef = useRef<string[]>(
    persistedState?.selectedGuideIds ?? [],
  );
  const workspacePersistTimeoutRef = useRef<number | null>(null);
  const applyingExternalPersistenceRef = useRef(false);

  const { overlayRef, selectedElementRef, hoverElementRef } = useOverlayRefs();
  const {
    selectionOriginRect,
    setSelectionOriginRect,
    hoverPointer,
    setHoverPointer,
    hoverElement,
    setHoverElement,
    selectedElement,
    setSelectedElement,
    clearSelectionRect,
  } = useMeasurerLocalState({
    selectedElementRef,
    hoverElementRef,
    selectionRectRef,
  });

  const {
    enabled,
    setEnabled,
    holdEnabled,
    snapEnabled,
    altPressed,
    setAltPressed,
    toolMode,
    setToolMode,
    rulersVisible,
    setRulersVisible,
    guidesEnabled,
    multiMeasureEnabled,
    snapGuidesEnabled,
    setSnapGuidesEnabled,
    selectNewGuideEnabled,
    setSelectNewGuideEnabled,
    setSnapEnabled,
    setMultiMeasureEnabled,
  } = useMeasureToggles({
    initialEnabled: persistedState?.enabled,
    initialToolMode:
      persistedState?.toolMode === "rulers" ? "none" : persistedState?.toolMode,
    initialRulersVisible:
      persistedState?.rulersVisible ?? persistedState?.toolMode === "rulers",
    initialSnapEnabled: persistedSettings.snapEnabled ?? snapEnabledDefault,
    initialSnapGuidesEnabled:
      persistedSettings.snapGuidesEnabled ?? snapGuidesEnabledDefault,
    initialSelectNewGuideEnabled:
      persistedSettings.selectNewGuideEnabled ?? selectNewGuideEnabledDefault,
    initialMultiMeasureEnabled:
      persistedSettings.multiMeasureEnabled ?? multiMeasureEnabledDefault,
  });
  const textInspector = useTextInspector(portalTarget, toolMode);
  const { start, setStart, end, setEnd, isDragging, setIsDragging } =
    useDragState();
  const {
    activeMeasurement,
    setActiveMeasurement,
    measurements,
    setMeasurements,
    selectedMeasurement,
    setSelectedMeasurement,
    selectedMeasurements,
    setSelectedMeasurements,
    hoverRect,
    setHoverRect,
    heldDistances,
    setHeldDistances,
  } = useMeasurementState({
    initialActiveMeasurement: persistedState?.activeMeasurement ?? null,
    initialMeasurements: persistedState?.measurements ?? [],
    initialHeldDistances: persistedState?.heldDistances ?? [],
  });
  const {
    guides,
    setGuides,
    draggingGuideId,
    setDraggingGuideId,
    selectedGuideIds,
    setSelectedGuideIds,
  } = useGuideState({
    initialGuides: persistedState?.guides ?? [],
    initialSelectedGuideIds: persistedState?.selectedGuideIds ?? [],
  });
  const [toolbarActive, setToolbarActive] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [settingsHighlightColor, setSettingsHighlightColor] = useState(
    persistedSettings.highlightColor ?? highlightColor,
  );
  const [settingsGuideColor, setSettingsGuideColor] = useState(
    persistedSettings.guideColor ?? guideColor,
  );
  const [settingsHoverHighlight, setSettingsHoverHighlight] = useState(
    persistedSettings.hoverHighlightEnabled ?? hoverHighlightEnabled,
  );
  const [settingsPersistOnReload, setSettingsPersistOnReload] = useState(
    persistedSettings.persistOnReload ?? persistOnReload,
  );
  const [settingsColorFormats, setSettingsColorFormats] = useState(
    persistedSettings.colorPickerFormats ?? colorPickerFormats,
  );
  const [settingsColorClickFormat, setSettingsColorClickFormat] = useState(
    persistedSettings.colorPickerClickFormat ?? colorPickerClickFormat,
  );
  const [settingsGuideStyle, setSettingsGuideStyle] = useState<GuideStyle>({
    ...guideStyleDefault,
    ...persistedSettings.guideStyle,
  });
  const [settingsRulerSettings, setSettingsRulerSettings] = useState<RulerSettings>({
    ...rulerSettingsDefault,
    ...persistedSettings.rulerSettings,
  });
  const [settingsScreenshot, setSettingsScreenshot] = useState<ScreenshotSettings>({
    ...DEFAULT_SCREENSHOT_SETTINGS,
    ...persistedSettings.screenshotSettings,
  });
  const [xrayVisible, setXrayVisible] = useState(xrayVisibleRef.current);
  const { clearGuideDragHold, scheduleGuideDragHold } = useGuideDragHold(ownerWindow);
  const [guidePreview, setGuidePreview] = useState<{
    orientation: "vertical" | "horizontal";
    position: number;
  } | null>(null);

  const resetSettings = () => {
    setSettingsHighlightColor(highlightColor);
    setSettingsGuideColor(guideColor);
    setSettingsHoverHighlight(hoverHighlightEnabled);
    setSettingsPersistOnReload(persistOnReload);
    setSettingsColorFormats([...colorPickerFormats]);
    setSettingsColorClickFormat(colorPickerClickFormat);
    setSnapEnabled(snapEnabledDefault);
    setSnapGuidesEnabled(snapGuidesEnabledDefault);
    setSelectNewGuideEnabled(selectNewGuideEnabledDefault);
    setMultiMeasureEnabled(multiMeasureEnabledDefault);
    setSettingsGuideStyle({ ...guideStyleDefault });
    setSettingsRulerSettings({ ...rulerSettingsDefault });
    setSettingsScreenshot({ ...DEFAULT_SCREENSHOT_SETTINGS });
  };
  const [guideOrientation, setGuideOrientation] = useState<
    "vertical" | "horizontal"
  >(persistedState?.guideOrientation ?? "vertical");

  enabledRef.current = enabled;
  xrayVisibleRef.current = xrayVisible;
  toolModeRef.current = toolMode;
  rulersVisibleRef.current = rulersVisible;
  guideOrientationRef.current = guideOrientation;
  measurementsRef.current = measurements;
  activeMeasurementRef.current = activeMeasurement;
  heldDistancesRef.current = heldDistances;
  guidesRef.current = guides;
  selectedGuideIdsRef.current = selectedGuideIds;

  const saveWorkspace = useCallback(() => {
    if (!settingsPersistOnReload) return;
    const workspace: MesurerStoredWorkspace = {
      enabled: enabledRef.current,
      xrayVisible: xrayVisibleRef.current,
      toolMode: toolModeRef.current,
      rulersVisible: rulersVisibleRef.current,
      guideOrientation: guideOrientationRef.current,
      guides: guidesRef.current,
      selectedGuideIds: selectedGuideIdsRef.current,
      measurements: measurementsRef.current.map(stripMeasurement),
      activeMeasurement: activeMeasurementRef.current
        ? stripMeasurement(activeMeasurementRef.current)
        : null,
      heldDistances: heldDistancesRef.current.map(stripDistance),
    };
    activePersistence.saveWorkspace(workspace);
  }, [activePersistence, settingsPersistOnReload]);

  const persistState = useCallback(() => {
    if (!settingsPersistOnReload) return;
    if (workspacePersistTimeoutRef.current !== null) {
      ownerWindow.clearTimeout(workspacePersistTimeoutRef.current);
    }
    workspacePersistTimeoutRef.current = ownerWindow.setTimeout(() => {
      workspacePersistTimeoutRef.current = null;
      saveWorkspace();
    }, 250);
  }, [ownerWindow, saveWorkspace, settingsPersistOnReload]);

  const persistSettings = useCallback(() => {
    activePersistence.saveSettings({
      highlightColor: settingsHighlightColor,
      guideColor: settingsGuideColor,
      hoverHighlightEnabled: settingsHoverHighlight,
      colorPickerFormats: settingsColorFormats,
      colorPickerClickFormat: settingsColorClickFormat,
      snapEnabled,
      snapGuidesEnabled,
      selectNewGuideEnabled,
      multiMeasureEnabled,
      persistOnReload: settingsPersistOnReload,
      guideStyle: settingsGuideStyle,
      rulerSettings: settingsRulerSettings,
      screenshotSettings: settingsScreenshot,
    });
  }, [
    multiMeasureEnabled,
    selectNewGuideEnabled,
    settingsColorClickFormat,
    settingsColorFormats,
    settingsGuideColor,
    settingsHighlightColor,
    settingsHoverHighlight,
    settingsPersistOnReload,
    snapEnabled,
    snapGuidesEnabled,
    activePersistence,
    settingsGuideStyle,
    settingsRulerSettings,
    settingsScreenshot,
  ]);

  useEffect(() => {
    if (applyingExternalPersistenceRef.current) {
      applyingExternalPersistenceRef.current = false;
      return;
    }
    persistSettings();
    if (settingsPersistOnReload) persistState();
  }, [persistSettings, persistState, settingsPersistOnReload]);

  useEffect(() => {
    if (!settingsPersistOnReload) return;
    const handleBeforeUnload = () => saveWorkspace();
    ownerWindow.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      ownerWindow.removeEventListener("beforeunload", handleBeforeUnload);
      if (workspacePersistTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(workspacePersistTimeoutRef.current);
        workspacePersistTimeoutRef.current = null;
        saveWorkspace();
      }
    };
  }, [ownerWindow, saveWorkspace, settingsPersistOnReload]);

  const clearPersistedWorkspace = useCallback(() => {
    enabledRef.current = false;
    toolModeRef.current = "none";
    rulersVisibleRef.current = false;
    xrayVisibleRef.current = false;
    guideOrientationRef.current = "vertical";
    measurementsRef.current = [];
    activeMeasurementRef.current = null;
    heldDistancesRef.current = [];
    guidesRef.current = [];
    selectedGuideIdsRef.current = [];
    setEnabled(false);
    setToolMode("none");
    setRulersVisible(false);
    setXrayVisible(false);
    setGuideOrientation("vertical");
    setMeasurements([]);
    setActiveMeasurement(null);
    setSelectedMeasurement(null);
    setSelectedMeasurements([]);
    setHeldDistances([]);
    setGuides([]);
    setSelectedGuideIds([]);
  }, [setActiveMeasurement, setEnabled, setGuideOrientation, setGuides, setHeldDistances, setMeasurements, setRulersVisible, setSelectedGuideIds, setSelectedMeasurement, setSelectedMeasurements, setToolMode]);

  const clearWorkspace = useCallback(() => {
    clearPersistedWorkspace();
    activePersistence.clearWorkspace();
  }, [activePersistence, clearPersistedWorkspace]);

  const applyPersistedWorkspace = useCallback((workspace: MesurerStoredWorkspace) => {
    enabledRef.current = workspace.enabled;
    toolModeRef.current = workspace.toolMode;
    rulersVisibleRef.current = workspace.rulersVisible;
    xrayVisibleRef.current = workspace.xrayVisible;
    guideOrientationRef.current = workspace.guideOrientation;
    measurementsRef.current = workspace.measurements;
    activeMeasurementRef.current = workspace.activeMeasurement;
    heldDistancesRef.current = workspace.heldDistances;
    guidesRef.current = workspace.guides;
    selectedGuideIdsRef.current = workspace.selectedGuideIds;
    setEnabled(workspace.enabled);
    setToolMode(workspace.toolMode);
    setRulersVisible(workspace.rulersVisible);
    setXrayVisible(workspace.xrayVisible);
    setGuideOrientation(workspace.guideOrientation);
    setMeasurements(workspace.measurements);
    setActiveMeasurement(workspace.activeMeasurement);
    setGuides(workspace.guides);
    setSelectedGuideIds(workspace.selectedGuideIds);
    setHeldDistances(workspace.heldDistances);
  }, [setActiveMeasurement, setEnabled, setGuideOrientation, setGuides, setHeldDistances, setMeasurements, setRulersVisible, setSelectedGuideIds, setToolMode]);

  const applyPersistenceSnapshot = useCallback((
    snapshot: MesurerPersistenceSnapshot | null,
    source?: PersistenceChangeSource,
  ) => {
    if (!snapshot) return;

    applyingExternalPersistenceRef.current = true;
    const settings = sanitizeStoredSettings(ownerWindow, snapshot.settings);
    if (settings.highlightColor !== undefined) setSettingsHighlightColor(settings.highlightColor);
    if (settings.guideColor !== undefined) setSettingsGuideColor(settings.guideColor);
    if (settings.hoverHighlightEnabled !== undefined) setSettingsHoverHighlight(settings.hoverHighlightEnabled);
    if (settings.colorPickerFormats !== undefined) setSettingsColorFormats(settings.colorPickerFormats);
    if (settings.colorPickerClickFormat !== undefined) setSettingsColorClickFormat(settings.colorPickerClickFormat);
    if (settings.persistOnReload !== undefined) setSettingsPersistOnReload(settings.persistOnReload);
    if (settings.snapEnabled !== undefined) setSnapEnabled(settings.snapEnabled);
    if (settings.snapGuidesEnabled !== undefined) setSnapGuidesEnabled(settings.snapGuidesEnabled);
    if (settings.selectNewGuideEnabled !== undefined) setSelectNewGuideEnabled(settings.selectNewGuideEnabled);
    if (settings.multiMeasureEnabled !== undefined) setMultiMeasureEnabled(settings.multiMeasureEnabled);
    if (settings.guideStyle !== undefined) setSettingsGuideStyle({ ...guideStyleDefault, ...settings.guideStyle });
    if (settings.rulerSettings !== undefined) setSettingsRulerSettings({ ...rulerSettingsDefault, ...settings.rulerSettings });
    if (settings.screenshotSettings !== undefined) {
      setSettingsScreenshot({ ...DEFAULT_SCREENSHOT_SETTINGS, ...settings.screenshotSettings });
    }

    const workspace = snapshot.workspace;
    if (source?.workspace !== false && workspace && (settings.persistOnReload ?? settingsPersistOnReload)) {
      applyPersistedWorkspace(workspace);
    }
    ownerWindow.setTimeout(() => {
      applyingExternalPersistenceRef.current = false;
    }, 0);
  }, [applyPersistedWorkspace, guideStyleDefault, ownerWindow, rulerSettingsDefault, setMultiMeasureEnabled, setSelectNewGuideEnabled, setSettingsColorClickFormat, setSettingsColorFormats, setSettingsGuideColor, setSettingsHighlightColor, setSettingsHoverHighlight, setSettingsPersistOnReload, setSnapEnabled, setSnapGuidesEnabled, settingsPersistOnReload]);

  const previousPersistenceRef = useRef(activePersistence);
  useEffect(() => {
    if (previousPersistenceRef.current === activePersistence) return;
    previousPersistenceRef.current = activePersistence;
    applyPersistenceSnapshot(storedState);
  }, [activePersistence, applyPersistenceSnapshot, storedState]);

  useEffect(() => {
    const unsubscribe = activePersistence.subscribe?.(applyPersistenceSnapshot);
    return unsubscribe;
  }, [activePersistence, applyPersistenceSnapshot]);

  const setEnabledPersisted = useCallback(
    (value: Parameters<typeof setEnabled>[0]) => {
      const next = typeof value === "function" ? value(enabledRef.current) : value;
      if (Object.is(next, enabledRef.current)) return;
      enabledRef.current = next;
      setEnabled(next);
      persistState();
    },
    [persistState, setEnabled],
  );

  const setRulersVisiblePersisted = useCallback(
    (value: Parameters<typeof setRulersVisible>[0]) => {
      const next =
        typeof value === "function"
          ? value(rulersVisibleRef.current)
          : value;
      if (Object.is(next, rulersVisibleRef.current)) return;
      rulersVisibleRef.current = next;
      setRulersVisible(next);
      persistState();
    },
    [persistState, setRulersVisible],
  );

  const setToolModePersisted = useCallback(
    (value: Parameters<typeof setToolMode>[0]) => {
      const next = typeof value === "function" ? value(toolModeRef.current) : value;
      if (Object.is(next, toolModeRef.current)) return;
      toolModeRef.current = next;
      setToolMode(next);
      if (next === "text-inspector") {
        textInspector.enable();
      } else {
        textInspector.disable();
      }
      persistState();
    },
    [persistState, setToolMode, textInspector],
  );

  const setGuideOrientationPersisted = useCallback(
    (value: Parameters<typeof setGuideOrientation>[0]) => {
      const next =
        typeof value === "function" ? value(guideOrientationRef.current) : value;
      if (Object.is(next, guideOrientationRef.current)) return;
      guideOrientationRef.current = next;
      setGuideOrientation(next);
      persistState();
    },
    [persistState, setGuideOrientation],
  );

  const setMeasurementsPersisted = useCallback(
    (value: Parameters<typeof setMeasurements>[0]) => {
      const next =
        typeof value === "function" ? value(measurementsRef.current) : value;
      if (Object.is(next, measurementsRef.current)) return;
      measurementsRef.current = next;
      setMeasurements(next);
      persistState();
    },
    [persistState, setMeasurements],
  );

  const setActiveMeasurementPersisted = useCallback(
    (value: Parameters<typeof setActiveMeasurement>[0]) => {
      const next =
        typeof value === "function"
          ? value(activeMeasurementRef.current)
          : value;
      if (Object.is(next, activeMeasurementRef.current)) return;
      activeMeasurementRef.current = next;
      setActiveMeasurement(next);
      persistState();
    },
    [persistState, setActiveMeasurement],
  );

  const setHeldDistancesPersisted = useCallback(
    (value: Parameters<typeof setHeldDistances>[0]) => {
      const next =
        typeof value === "function" ? value(heldDistancesRef.current) : value;
      if (Object.is(next, heldDistancesRef.current)) return;
      heldDistancesRef.current = next;
      setHeldDistances(next);
      persistState();
    },
    [persistState, setHeldDistances],
  );

  const setGuidesPersisted = useCallback(
    (value: Parameters<typeof setGuides>[0]) => {
      const next = typeof value === "function" ? value(guidesRef.current) : value;
      if (Object.is(next, guidesRef.current)) return;
      guidesRef.current = next;
      setGuides(next);
      persistState();
    },
    [persistState, setGuides],
  );

  const setSelectedGuideIdsPersisted = useCallback(
    (value: Parameters<typeof setSelectedGuideIds>[0]) => {
      const next =
        typeof value === "function" ? value(selectedGuideIdsRef.current) : value;
      if (Object.is(next, selectedGuideIdsRef.current)) return;
      selectedGuideIdsRef.current = next;
      setSelectedGuideIds(next);
      persistState();
    },
    [persistState, setSelectedGuideIds],
  );

  const {
    recordSnapshot,
    createActionCommit,
    setToolModeWithHistory,
    setGuideOrientationWithHistory,
    setEnabledWithHistory,
    undo: undoHistory,
    redo: redoHistory,
  } = useMeasurerHistory({
    toggles: {
      enabled,
      setEnabled: setEnabledPersisted,
      toolMode,
      setToolMode: setToolModePersisted,
      guideOrientation,
      setGuideOrientation: setGuideOrientationPersisted,
    },
    measurements: {
      measurements,
      setMeasurements: setMeasurementsPersisted,
      activeMeasurement,
      setActiveMeasurement: setActiveMeasurementPersisted,
      selectedMeasurements,
      setSelectedMeasurements,
      selectedMeasurement,
      setSelectedMeasurement,
      heldDistances,
      setHeldDistances: setHeldDistancesPersisted,
    },
    guides: {
      guides,
      setGuides: setGuidesPersisted,
      selectedGuideIds,
      setSelectedGuideIds: setSelectedGuideIdsPersisted,
      draggingGuideId,
      setDraggingGuideId,
    },
    transient: {
      setStart,
      setEnd,
      setIsDragging,
      setGuidePreview,
      setHoverRect,
      setHoverElement,
      setSelectedElement,
      clearSelectionRect,
    },
  });

  const undo = useCallback(() => {
    if (toolMode === "text-inspector" && textInspector.undo()) return;
    undoHistory();
  }, [textInspector, toolMode, undoHistory]);

  const redo = useCallback(() => {
    if (toolMode === "text-inspector" && textInspector.redo()) return;
    redoHistory();
  }, [redoHistory, textInspector, toolMode]);

  const clearAll = useCallback(() => {
    if (toolMode === "text-inspector") {
      textInspector.clear();
    }
    recordSnapshot();
    clearGuideDragHold();
    setStart(null);
    setEnd(null);
    setIsDragging(false);
    setActiveMeasurementPersisted(null);
    setMeasurementsPersisted([]);
    setSelectedMeasurement(null);
    setSelectedMeasurements([]);
    clearSelectionRect();
    setSelectedElement(null);
    setHoverRect(null);
    setHoverElement(null);
    setGuidesPersisted([]);
    setSelectedGuideIdsPersisted([]);
    setHeldDistancesPersisted([]);
  }, [
    clearGuideDragHold,
    clearSelectionRect,
    recordSnapshot,
    setActiveMeasurementPersisted,
    setEnd,
    setGuidesPersisted,
    setHeldDistancesPersisted,
    setHoverElement,
    setHoverRect,
    setIsDragging,
    setMeasurementsPersisted,
    setSelectedElement,
    setSelectedGuideIdsPersisted,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setStart,
    textInspector,
    toolMode,
  ]);

  const removeSelectedGuides = useCallback(() => {
    if (selectedGuideIds.length === 0) return false;
    recordSnapshot();
    setGuidesPersisted((prev) =>
      prev.filter((guide) => !selectedGuideIds.includes(guide.id)),
    );
    setSelectedGuideIdsPersisted([]);
    return true;
  }, [
    recordSnapshot,
    selectedGuideIds,
    setGuidesPersisted,
    setSelectedGuideIdsPersisted,
  ]);

  const colorPicker = useColorPicker({
    ownerWindow,
    clickFormat: settingsColorClickFormat,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolModeNone: () => setToolModeWithHistory("none"),
  });

  const screenshot = useScreenshot({
    ownerDocument,
    ownerWindow,
    toolbarRef,
    overlayRef,
    enabled,
    captureVisibleTab,
    settings: settingsScreenshot,
    setEnabled: (value) => setEnabledWithHistory(value),
    setToolbarActive,
    onPrepare: () => {
      colorPicker.setActive(false);
      setSettingsOpen(false);
    },
  });

  const openColorPicker = useCallback(() => {
    screenshot.closeUi();
    void colorPicker.open();
  }, [colorPicker.open, screenshot.closeUi]);

  const initialSettingsTab: SettingsTab = settingsTabForContext({
    screenshotOpen: screenshot.active || Boolean(screenshot.previewUrl),
    colorPickerActive: colorPicker.active,
    toolMode,
    rulersVisible,
  });

  const toggleSettings = useCallback(() => {
    const tab = initialSettingsTab;
    screenshot.closeUi();
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, [initialSettingsTab, screenshot.closeUi, settingsOpen]);

  useHotkeys({
    eventTarget: ownerWindow,
    clearAll,
    undo,
    redo,
    removeSelectedGuides,
    setEnabled: setEnabledWithHistory,
    setToolMode: setToolModeWithHistory,
    setRulersVisible: setRulersVisiblePersisted,
    setAltPressed,
    isOverlayActive: () => enabled && (toolMode !== "none" || toolbarActive),
    setGuideOrientation: setGuideOrientationWithHistory,
    onInteract: () => setToolbarActive(true),
    onColorPicker: openColorPicker,
    onScreenshot: screenshot.toggleSelection,
    onCloseScreenshot: screenshot.closeUi,
    isScreenshotActive: () => screenshot.active || Boolean(screenshot.previewUrl),
    onToggleXray: () => setXrayVisible((previous) => !previous),
    onToggleSettings: toggleSettings,
    isSettingsOpen: () => settingsOpen,
    onCloseColorPicker: () => colorPicker.setActive(false),
    isColorPickerActive: () => colorPicker.active,
  });

  useResizeSync({
    document: ownerDocument,
    window: ownerWindow,
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
    setSelectedMeasurement,
    setGuides: setGuidesPersisted,
    selectedElementRef,
  });

  useLiveElementTracking({
    document: ownerDocument,
    window: ownerWindow,
    enabled,
    selectionEnabled: toolMode === "select",
    selectedElementRef,
    hoverElementRef,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setHoverRect,
    setMeasurements: setMeasurementsPersisted,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setHeldDistances: setHeldDistancesPersisted,
  });

  useXray(ownerDocument, xrayVisible);
  useToolbarIdle({
    ownerWindow,
    toolbarRef,
    toolbarActive,
    toolMode,
    setToolbarActive,
  });
  useGuideWindowEvents({
    ownerDocument,
    ownerWindow,
    enabled,
    settingsOpen,
    toolMode,
    guides,
    toolbarRef,
    createActionCommit,
    setGuides: setGuidesPersisted,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
  });

  const selectionToolRef = useRef(toolMode);

  if (selectionToolRef.current !== toolMode) {
    selectionToolRef.current = toolMode;
    if (toolMode !== "select") {
      setSelectedElement(null);
      setHoverElement(null);
      setHoverRect(null);
      setHoverPointer(null);
      setSelectedMeasurement(null);
      setSelectedMeasurements([]);
      clearSelectionRect();
    }
  }

  useSelectionAnimationCleanup({
    ownerWindow,
    selectionOriginRect,
    selectedMeasurement,
    selectedMeasurements,
    setSelectionOriginRect,
    setSelectedMeasurement,
    setSelectedMeasurements,
  });

  const displayedMeasurements = holdEnabled
    ? measurements
    : multiMeasureEnabled && measurements.length > 0
      ? measurements
      : activeMeasurement
        ? [activeMeasurement]
        : [];

  const {
    activeRect,
    activeWidth,
    activeHeight,
    displayedSelectedMeasurements,
    hoverGuide,
    optionPairOverlay,
    optionContainerLines,
    guideDistanceOverlay,
    outlineColor,
    fillColor,
    guideColorActive,
    guideColorHover,
    guideColorDefault,
    guideColorPreview,
    hoverRectToShow,
    selectedEdgeVisibility,
    hoverEdgeVisibility,
    measurementEdgeVisibility,
  } = useMeasurerDerived({
    document: ownerDocument,
    window: ownerWindow,
    start,
    end,
    selectedMeasurements,
    selectedMeasurement,
    selectionOriginRect,
    guides,
    selectedGuideIds,
    hoverPointer,
    hoverRect,
    hoverElement,
    selectedElement,
    altPressed,
    guidesEnabled,
    guidePreview,
    displayedMeasurements,
    hoverHighlightEnabled: settingsHoverHighlight,
    highlightColor: settingsHighlightColor,
    guideColor: settingsGuideColor,
  });

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  } = useMeasurerPointer({
    document: ownerDocument,
    window: ownerWindow,
    toolbarRef,
    overlayRef,
    selectionRectRef,
    createActionCommit,
    clearGuideDragHold,
    scheduleGuideDragHold,
    enabled,
    settingsOpen,
    toolMode,
    guidesEnabled,
    snapEnabled,
    snapGuidesEnabled,
    selectNewGuideEnabled,
    altPressed,
    guideOrientation,
    hoverHighlightEnabled,
    start,
    end,
    isDragging,
    selectedMeasurements,
    selectedMeasurement,
    selectedGuideIds,
    guides,
    draggingGuideId,
    optionPairOverlay,
    setAltPressed,
    setGuidePreview,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setGuides: setGuidesPersisted,
    setStart,
    setEnd,
    setIsDragging,
    setHeldDistances: setHeldDistancesPersisted,
    setDraggingGuideId,
    setActiveMeasurement: setActiveMeasurementPersisted,
    setMeasurements: setMeasurementsPersisted,
    setSelectedMeasurements,
    setSelectedMeasurement,
    setSelectionOriginRect,
    setSelectedElement,
    setHoverRect,
    setHoverElement,
    setHoverPointer,
    clearSelectionRect,
  });

  const removeHeldDistance = useCallback(
    (id: string) => {
      recordSnapshot();
      setHeldDistancesPersisted((prev) =>
        prev.filter((distance) => distance.id !== id),
      );
    },
    [recordSnapshot, setHeldDistancesPersisted],
  );

  const {
    startGuideFromRuler,
    moveGuideFromRuler,
    finishGuideFromRuler,
    cancelGuideFromRuler,
    handleGuidePointerDown,
    handleGuidePointerUp,
    overlayGuides,
  } = useRulerGuides({
    ownerDocument,
    ownerWindow,
    overlayRef,
    enabled,
    snapGuidesEnabled,
    selectNewGuideEnabled,
    settingsOpen,
    settingsTab,
    guides,
    createActionCommit,
    setGuides: setGuidesPersisted,
    setSelectedGuideIds: setSelectedGuideIdsPersisted,
    setDraggingGuideId,
    scheduleGuideDragHold,
    clearGuideDragHold,
  });

  const overlayInteractive = enabled && !settingsOpen;

  return createPortal(
    <div
      ref={overlayRef}
      className="mesurer-root msr:pointer-events-none msr:fixed msr:inset-0 msr:z-50"
    >
      {enabled && rulersVisible ? (
        <RulersOverlay
          ownerWindow={ownerWindow}
          settings={settingsRulerSettings}
          interactive={!settingsOpen}
          forceVisible={settingsOpen}
          onStartGuide={startGuideFromRuler}
          onMoveGuide={moveGuideFromRuler}
          onFinishGuide={finishGuideFromRuler}
          onCancelGuide={cancelGuideFromRuler}
          guides={guides}
          selectedGuideIds={selectedGuideIds}
        />
      ) : null}
      <MeasurerOverlay
        enabled={enabled}
        interactive={overlayInteractive}
        toolMode={toolMode}
        guidePointerEvents={overlayInteractive && (toolMode !== "none" || rulersVisible)}
        guidesEnabled={guidesEnabled}
        altPressed={altPressed}
        isDragging={isDragging}
        displayedMeasurements={displayedMeasurements}
        measurementEdgeVisibility={measurementEdgeVisibility}
        activeRect={activeRect}
        activeWidth={activeWidth}
        activeHeight={activeHeight}
        fillColor={fillColor}
        outlineColor={outlineColor}
        hoverRectToShow={hoverRectToShow}
        hoverEdgeVisibility={hoverEdgeVisibility}
        guidePreview={guidePreview}
        guideColorPreview={guideColorPreview}
        displayedSelectedMeasurements={displayedSelectedMeasurements}
        selectedEdgeVisibility={selectedEdgeVisibility}
        heldDistances={heldDistances}
        optionPairOverlay={optionPairOverlay}
        guideDistanceOverlay={guideDistanceOverlay}
        optionContainerLines={optionContainerLines}
        guides={overlayGuides}
        hoverGuide={hoverGuide}
        draggingGuideId={draggingGuideId}
        selectedGuideIds={selectedGuideIds}
        guideColorActive={guideColorActive}
        guideColorHover={guideColorHover}
        guideColorDefault={guideColorDefault}
        guideStyle={settingsGuideStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onRemoveHeldDistance={removeHeldDistance}
        onGuidePointerDown={handleGuidePointerDown}
        onGuidePointerUp={handleGuidePointerUp}
        onGuidePointerCancel={handleGuidePointerUp}
      />

      <ColorPicker
        active={colorPicker.active}
        sample={colorPicker.sample}
        unsupported={colorPicker.unsupported}
        ownerWindow={ownerWindow}
        toolbarRef={toolbarRef}
        formats={settingsColorFormats}
        favoriteFormat={settingsColorClickFormat}
        onClose={() => colorPicker.setActive(false)}
      />

      <ScreenshotSelectOverlay
        ref={screenshot.overlayRef}
        active={screenshot.active}
        rect={screenshot.rect}
        onPointerDown={screenshot.handlePointerDown}
        onPointerMove={screenshot.handlePointerMove}
        onPointerUp={screenshot.handlePointerUp}
      />

      <Toolbar
        ref={toolbarRef}
        eventTarget={ownerWindow}
        toolMode={toolMode}
        setEnabled={setEnabledWithHistory}
        setToolMode={setToolModeWithHistory}
        xrayVisible={xrayVisible}
        setXrayVisible={setXrayVisible}
        rulersVisible={rulersVisible}
        setRulersVisible={setRulersVisiblePersisted}
        guideOrientation={guideOrientation}
        setGuideOrientation={setGuideOrientationWithHistory}
        onInteract={() => setToolbarActive(true)}
        colorPickerActive={colorPicker.active}
        setColorPickerActive={colorPicker.setActive}
        onColorPickerClick={openColorPicker}
        screenshotActive={screenshot.active}
        onScreenshotClick={screenshot.toggleSelection}
        onCancelScreenshot={screenshot.closeUi}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        highlightColor={settingsHighlightColor}
        setHighlightColor={setSettingsHighlightColor}
        guideColor={settingsGuideColor}
        setGuideColor={setSettingsGuideColor}
        hoverHighlight={settingsHoverHighlight}
        setHoverHighlight={setSettingsHoverHighlight}
        persistOnReload={settingsPersistOnReload}
        setPersistOnReload={setSettingsPersistOnReload}
        colorPickerFormats={settingsColorFormats}
        setColorPickerFormats={setSettingsColorFormats}
        colorPickerClickFormat={settingsColorClickFormat}
        setColorPickerClickFormat={setSettingsColorClickFormat}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        snapGuidesEnabled={snapGuidesEnabled}
        setSnapGuidesEnabled={setSnapGuidesEnabled}
        selectNewGuideEnabled={selectNewGuideEnabled}
        setSelectNewGuideEnabled={setSelectNewGuideEnabled}
        multiMeasureEnabled={multiMeasureEnabled}
        setMultiMeasureEnabled={setMultiMeasureEnabled}
         guideStyle={settingsGuideStyle}
         setGuideStyle={setSettingsGuideStyle}
         rulerSettings={settingsRulerSettings}
         setRulerSettings={setSettingsRulerSettings}
         screenshotSettings={settingsScreenshot}
         setScreenshotSettings={setSettingsScreenshot}
         settingsTab={settingsTab}
         setSettingsTab={setSettingsTab}
         onToggleSettings={toggleSettings}
         onResetSettings={resetSettings}
         onClearWorkspace={clearWorkspace}
         screenshotError={screenshot.error}
         screenshotPreviewUrl={screenshot.previewUrl}
         onScreenshotPreviewExited={screenshot.dismissPreview}
       />
    </div>,
    portalTarget,
  );
}

export default function Measurer({
  highlightColor = "oklch(0.62 0.18 255)",
  guideColor = "oklch(0.63 0.26 29.23)",
  hoverHighlightEnabled = true,
  persistOnReload = false,
  portalTarget,
  persistKey,
  colorPickerFormats = ["hex", "rgb", "oklch"],
  colorPickerClickFormat = "hex",
  snapEnabled = true,
  snapGuidesEnabled = true,
  selectNewGuideEnabled = true,
  multiMeasureEnabled = false,
  guideStyle,
  rulerSettings,
  persistence,
  onPersistenceError,
  captureVisibleTab,
}: MeasurerProps) {
  if (typeof document !== "undefined") {
    ensureMeasurerStyles(MESURER_STYLES, portalTarget);
  }

  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <MeasurerClient
      highlightColor={highlightColor}
      guideColor={guideColor}
      hoverHighlightEnabled={hoverHighlightEnabled}
      persistOnReload={persistOnReload}
      persistKey={persistKey}
      colorPickerFormats={colorPickerFormats}
      colorPickerClickFormat={colorPickerClickFormat}
      snapEnabled={snapEnabled}
      snapGuidesEnabled={snapGuidesEnabled}
      selectNewGuideEnabled={selectNewGuideEnabled}
      multiMeasureEnabled={multiMeasureEnabled}
      guideStyle={{ ...DEFAULT_GUIDE_STYLE, ...guideStyle }}
      rulerSettings={{ ...DEFAULT_RULER_SETTINGS, ...rulerSettings }}
      persistence={persistence}
      onPersistenceError={onPersistenceError}
      captureVisibleTab={captureVisibleTab}
      portalTarget={portalTarget ?? document.body}
    />
  );
}
