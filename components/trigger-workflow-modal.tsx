"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Copy, Loader2 } from "lucide-react";
import { isValidCron } from "cron-validator";
import { toast } from "sonner";

interface TriggerWorkflowModalProps {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  workflowId: string;
}

export function TriggerWorkflowModal({ open, onOpenChange, workflowId }: TriggerWorkflowModalProps) {
  const [tab, setTab] = useState("manual");
  const [jsonInput, setJsonInput] = useState("{}");
  const [cronExpr, setCronExpr] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const webhookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/hooks/${workflowId}`;
  const isCronValid = isValidCron(cronExpr, { seconds: false });

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 1000);
  };

  const handleManualTrigger = async () => {
    try {
      setLoading(true);
      setOutput(null);
      let parsedInput;
      try {
        parsedInput = JSON.parse(jsonInput);
      } catch (e) {
        toast.error("Invalid JSON. Please check your input.");
        setLoading(false);
        return;
      }
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow: workflowId,
          input: parsedInput,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setOutput(data.error ? String(data.error) : "Trigger failed");
        throw new Error("Trigger failed");
      }
      setOutput(data.output ? String(data.output) : JSON.stringify(data, null, 2));
      toast.success("Workflow triggered successfully");
    } catch (err) {
      console.error("Trigger failed", err);
      if (!output) setOutput("Failed to trigger workflow");
      toast.error("Failed to trigger workflow");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleCron = async () => {
    if (!isCronValid) return;

    try {
      setLoading(true);
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow: workflowId,
          schedule: cronExpr,
          input: JSON.parse(jsonInput),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule workflow");
      }

      toast.success("Workflow scheduled successfully");
      onOpenChange(false);
    } catch (err) {
      console.error("Schedule failed", err);
      toast.error("Failed to schedule workflow");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Workflow</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="manual" value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Textarea
              className="mb-2"
              rows={6}
              placeholder='Enter JSON payload'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <Button onClick={handleManualTrigger} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Triggering...
                </>
              ) : (
                "Trigger"
              )}
            </Button>
            {output && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
                <strong>Output:</strong>
                <pre className="whitespace-pre-wrap break-all text-sm">{output}</pre>
              </div>
            )}
          </TabsContent>

          <TabsContent value="webhook">
            <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={webhookUrl} />
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              </div>
              <Alert>
                <AlertTitle>Webhook URL</AlertTitle>
                <AlertDescription>
                  Send a POST request to this URL with your JSON payload to trigger the workflow.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="space-y-4">
            <Input
              placeholder="*/5 * * * *"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              className="mb-2"
            />
            {!isCronValid && cronExpr && (
              <Alert variant="destructive">
                <AlertTitle>Invalid cron expression</AlertTitle>
                  <AlertDescription>Use standard 5-field cron syntax (minute hour day month weekday).</AlertDescription>
              </Alert>
            )}
            {isCronValid && cronExpr && (
              <Alert>
                <AlertTitle>Valid cron expression</AlertTitle>
                <AlertDescription>This will run as scheduled.</AlertDescription>
              </Alert>
            )}
              <Button 
                onClick={handleScheduleCron} 
                disabled={!isCronValid || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "Schedule"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
