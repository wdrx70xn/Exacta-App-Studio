import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateApp } from "@/hooks/useCreateApp";
import { useCheckName } from "@/hooks/useCheckName";
import { useSetAtom } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { NEON_TEMPLATE_IDS, Template } from "@/shared/templates";

import { useRouter } from "@tanstack/react-router";

import { Loader2, Settings2, AppWindow } from "lucide-react";
import { neonTemplateHook } from "@/client_logic/template_hook";
import { showError } from "@/lib/toast";
import { useRuntimeSelector } from "./RuntimeSelector";

interface CreateAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | undefined;
}

export function CreateAppDialog({
  open,
  onOpenChange,
  template,
}: CreateAppDialogProps) {
  const { t } = useTranslation(["home", "common"]);
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const [appName, setAppName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createApp } = useCreateApp();
  const { data: nameCheckResult } = useCheckName(appName);
  const router = useRouter();
  const {
    open: openRuntimeSelector,
    close: closeRuntimeSelector,
    selection,
    RuntimeSelector: RuntimeSelectorComponent,
  } = useRuntimeSelector();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appName.trim()) {
      return;
    }

    if (nameCheckResult?.exists) {
      return;
    }

    // For now, use default runtime (Node.js) if no selection is made
    // In the future, we could integrate RuntimeSelector into this dialog
    const runtimeProvider = selection?.runtimeId || "node";
    const stackType = selection?.stackType || "react";

    setIsSubmitting(true);
    try {
      const result = await createApp({
        name: appName.trim(),
        runtimeProvider,
        stackType,
      });
      if (template && NEON_TEMPLATE_IDS.has(template.id)) {
        await neonTemplateHook({
          appId: result.app.id,
          appName: result.app.name,
        });
      }
      setSelectedAppId(result.app.id);
      // Navigate to the new app's first chat
      router.navigate({
        to: "/chat",
        search: { id: result.chatId },
      });
      setAppName("");
      onOpenChange(false);
      closeRuntimeSelector();
    } catch (error) {
      showError(error as any);
      // Error is already handled by createApp hook or shown above
      console.error("Error creating app:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNameValid = appName.trim().length > 0;
  const nameExists = nameCheckResult?.exists;
  const canSubmit = isNameValid && !nameExists && !isSubmitting;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("home:createNewApp")}</DialogTitle>
            <DialogDescription>
              {t("home:createAppUsingTemplate", { template: template?.title })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="appName">{t("home:appName")}</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder={t("home:enterAppName")}
                  className={nameExists ? "border-red-500" : ""}
                  disabled={isSubmitting}
                />
                {nameExists && (
                  <p className="text-sm text-red-500">
                    {t("home:appNameAlreadyExists")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Runtime & Stack</Label>
              <Button
                type="button"
                variant="outline"
                onClick={openRuntimeSelector}
                className="justify-start font-normal"
              >
                {selection ? (
                  <div className="flex items-center gap-2">
                    <AppWindow className="h-4 w-4" />
                    <span>
                      {selection.runtimeId === "dotnet"
                        ? ".NET"
                        : selection.runtimeId === "tauri"
                          ? "Tauri"
                          : "Node.js"}{" "}
                      / {selection.stackType}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Settings2 className="h-4 w-4" />
                    <span>Default (Node.js / React)</span>
                  </div>
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("common:cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? t("common:creating") : t("home:createApp")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {RuntimeSelectorComponent}
    </>
  );
}
