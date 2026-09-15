// Regression for the silent-save defect in EstimationModal: handleSave caught
// the API rejection with only a comment ("keep modal open on error"), so a
// failed story-point save looked identical to a successful one minus the close
// — the Save button simply un-disabled and the user had no idea the server
// rejected it. The modal is inline z-50, so the toast (z-60) renders above it
// and a failure message is genuinely reachable while the dialog stays open.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EstimationModal } from "../components/estimation/EstimationModal";
import { setTaskEstimation } from "../lib/api";

const push = vi.fn();

vi.mock("../lib/api", () => ({
  setTaskEstimation: vi.fn(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push }),
}));

vi.mock("react-i18next", async () => {
  const i18next = await import("i18next");
  const en = (await import("../i18n/en.json")).default;
  const instance = i18next.createInstance();
  await instance.init({
    resources: { en: { translation: en } },
    lng: "en",
    fallbackLng: "en",
  });
  return {
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) =>
        instance.t(key, options) as string,
    }),
  };
});

function renderModal(onSaved = vi.fn()) {
  render(
    <EstimationModal
      open
      onClose={() => {}}
      workspaceId="ws1"
      projectId="p1"
      taskId="t1"
      currentEstimate={null}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

async function pickAndSave() {
  fireEvent.click(screen.getByRole("button", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
  await waitFor(() => expect(setTaskEstimation).toHaveBeenCalledOnce());
}

describe("EstimationModal reports save failures", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(setTaskEstimation).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("surfaces the error toast and keeps the modal open when the save rejects", async () => {
    vi.mocked(setTaskEstimation).mockRejectedValueOnce(new Error("offline"));
    const onSaved = renderModal();
    await pickAndSave();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("Failed to save estimation.", "error"),
    );
    // The deliberate "stay open so the pick isn't lost" half of the old fix
    // must survive: no success callback, dialog still rendered.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes on success without an error toast", async () => {
    vi.mocked(setTaskEstimation).mockResolvedValueOnce(undefined);
    const onSaved = renderModal();
    await pickAndSave();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(3));
    expect(push).not.toHaveBeenCalled();
  });
});
