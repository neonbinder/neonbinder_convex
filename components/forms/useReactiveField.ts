import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

/**
 * NEO-39 — shared reactive-safe field primitive.
 *
 * Fixes a recurring bug class: a single component is simultaneously a live
 * reactive view of server state (`useQuery` pushes fresh values underneath
 * you) AND an editor with local draft state. The old controlled pattern
 * (`value={draft}` + `useEffect(() => setDraft(value), [value])`) loses the
 * race — an externally triggered re-render resets/lags the controlled value
 * before the user's keystrokes commit, so the submit handler reads stale,
 * empty, or cross-wired state. Confirmed instances: NEO-36 (add-card form
 * dropped the last-typed field), NEO-38 (SetAttributesPanel committed a value
 * into the wrong field).
 *
 * The fix, generalized into one tested primitive:
 *
 *   1. The input is **uncontrolled** — backed by react-hook-form's `register`
 *      (ref-based), never a React `value` binding. React never reconciles the
 *      DOM value, so the field holds exactly what the user typed.
 *   2. **Focus-guard mirroring** — external `value` changes are written into
 *      the input ONLY when the field is neither focused nor mid-save. While
 *      the user is typing (or a save is in flight) external pushes are ignored
 *      so in-flight keystrokes are never stomped.
 *   3. **Read-at-commit** — commit always reads the live DOM/RHF value via
 *      `getValues`, never a lagged React-state copy.
 *
 * This hook owns ONE field. Each editable row mounts its own
 * `useReactiveField` (per-field autosave), mirroring how the existing rows
 * each carry their own busy/error/commit state.
 */

export type ReactiveFieldOptions = {
  /**
   * The external (reactive) value this field mirrors + displays. When the
   * field is idle (not focused, not saving) a change here is written into the
   * input. While focused/saving it is ignored.
   */
  value: string;
  /**
   * Persist a non-empty, changed value. Called with the trimmed live value.
   * Throwing surfaces the message via the returned `error`.
   */
  onSave: (trimmed: string) => Promise<unknown> | unknown;
  /**
   * Optional handler for an empty commit (the user cleared the field). When
   * provided it runs instead of `onSave` — used by rows where "" means
   * "revert to inherited" (a clear-override mutation). When omitted, an empty
   * commit is a no-op that resets the input back to `value`.
   */
  onEmptyCommit?: () => Promise<unknown> | unknown;
  /**
   * Baseline used for the no-op check: if the trimmed live value equals this,
   * commit does nothing. Defaults to `value`. Rows whose displayed value
   * differs from their persisted value (e.g. a per-card field that shows the
   * inherited fallback but persists only an explicit override) pass the
   * persisted value here.
   */
  compareBaseline?: string;
};

/**
 * Props the consumer spreads onto its `<input>`. `name`/`ref`/`onChange`
 * come from react-hook-form's `register`; `onFocus`/`onBlur`/`onKeyDown`
 * layer the focus-guard + commit-on-blur/Enter on top.
 */
export type ReactiveFieldInputProps = {
  name: string;
  ref: (el: HTMLInputElement | null) => void;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onFocus: React.FocusEventHandler<HTMLInputElement>;
  onBlur: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
};

export type ReactiveFieldApi = {
  /** Spread onto the `<input>`: wires register + focus-guard + commit. */
  inputProps: ReactiveFieldInputProps;
  /** True while a save is in flight. Drives the disabled/busy affordance. */
  busy: boolean;
  /** Last commit error message, or null. */
  error: string | null;
  /** Imperatively commit the live value (blur + Enter both route here). */
  commit: () => Promise<void>;
};

const FIELD_NAME = "field" as const;

export function useReactiveField({
  value,
  onSave,
  onEmptyCommit,
  compareBaseline,
}: ReactiveFieldOptions): ReactiveFieldApi {
  // One react-hook-form instance per field. Uncontrolled/ref-based — no
  // React `value` binding, which is the whole point: the DOM is the source
  // of truth for in-flight edits.
  const { register, getValues, setValue } = useForm<{ [FIELD_NAME]: string }>({
    defaultValues: { [FIELD_NAME]: value },
  });

  const registration = register(FIELD_NAME);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track focus locally so the mirroring effect can honor the focus-guard
  // without reaching for document.activeElement (which is brittle under the
  // headless/jsdom edge cases the old hand-rolled guards hit).
  const focusedRef = useRef(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep a ref to the input so the mirroring effect and commit can read/write
  // the live DOM value. RHF's `register` provides its own ref; we tee it.
  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el;
      registration.ref(el);
    },
    [registration],
  );

  // Focus-guard mirroring: when the external value changes AND the field is
  // idle (not focused, not saving), write it into the input. While focused or
  // saving we deliberately drop the update so in-flight typing is preserved.
  useEffect(() => {
    if (focusedRef.current || busyRef.current) return;
    setValue(FIELD_NAME, value);
    if (inputRef.current) inputRef.current.value = value;
  }, [value, setValue]);

  const runCommit = useCallback(async () => {
    if (busyRef.current) return;
    // Read the LIVE value at commit — never a lagged copy.
    const raw = getValues(FIELD_NAME) ?? "";
    const trimmed = raw.trim();
    const baseline = compareBaseline ?? value;

    // No-op: unchanged vs the persisted baseline.
    if (trimmed === baseline) return;

    if (trimmed.length === 0) {
      if (onEmptyCommit) {
        setBusy(true);
        busyRef.current = true;
        try {
          await onEmptyCommit();
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
          busyRef.current = false;
        }
        return;
      }
      // No empty handler → treat as no-op and reset the input to the
      // external value (matches the existing "empty input reverts" UX).
      setValue(FIELD_NAME, value);
      if (inputRef.current) inputRef.current.value = value;
      return;
    }

    setBusy(true);
    busyRef.current = true;
    try {
      await onSave(trimmed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }, [getValues, setValue, value, compareBaseline, onSave, onEmptyCommit]);

  const handleFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = false;
      // Preserve RHF's own onBlur (touched/dirty bookkeeping) then commit.
      void registration.onBlur(e);
      void runCommit();
    },
    [registration, runCommit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void runCommit();
      }
    },
    [runCommit],
  );

  return {
    inputProps: {
      name: registration.name,
      ref: setInputRef,
      onChange: registration.onChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown,
    },
    busy,
    error,
    commit: runCommit,
  };
}
