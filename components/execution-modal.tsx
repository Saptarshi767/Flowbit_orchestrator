"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

export default function ExecutionModal({
  open,
  onClose,
  workflow,
}: {
  open: boolean;
  onClose: () => void;
  workflow: string | null;
}) {
  const [input, setInput] = useState("");
  const [cron, setCron] = useState("");

  const webhookURL = typeof window !== "undefined"
    ? `${window.location.origin}/api/hooks/${workflow}`
    : "";

  const handleManualTrigger = async () => {
    await fetch("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow, input: { text: input, email_text: input, json_input: input } }),
    });
    onClose();
  };

  const handleSchedule = async () => {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow, cron, input: { text: input } }),
    });
    console.log(await res.json());
    onClose();
  };

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Workflow: {workflow}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="manual" className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-2">
            <Label>Input JSON Payload</Label>
            <Input value={input} onChange={(e) => setInput(e.target.value)} />
            <Button onClick={handleManualTrigger} className="w-full mt-2">Run</Button>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-2">
            <Label>Public Webhook URL</Label>
            <Input readOnly value={webhookURL} />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-2">
            <Label>Input</Label>
            <Input value={input} onChange={(e) => setInput(e.target.value)} />
            <Label className="mt-2">Cron Expression</Label>
            <Input value={cron} onChange={(e) => setCron(e.target.value)} />
            <Button onClick={handleSchedule} className="w-full mt-2">Schedule</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}