"use client"
import { useEffect, useState, useRef } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle, XCircle, Clock, AlertTriangle, Info, ChevronDown, ChevronRight, Copy, Loader2, AlertCircle, Download } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ExecutionDetailsModalProps {
  open: boolean
  onOpenChange: (val: boolean) => void
  executionId: string
  engine: "langflow" | "flowbit"
}

interface ExecutionLog {
  timestamp: string
  level: "info" | "error" | "warning"
  message: string
}

interface ExecutionDetails {
  id: string
  status: "running" | "completed" | "failed"
  startTime: string
  endTime?: string
  input: any
  output?: any
  error?: string
  logs?: string
}

export function ExecutionDetailsModal({ open, onOpenChange, executionId, engine }: ExecutionDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("logs");
  const [logs, setLogs] = useState<string[]>([]);
  const [messageLogs, setMessageLogs] = useState<string[]>([]);
  const [details, setDetails] = useState<ExecutionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messageLogsEndRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [messageLogSearch, setMessageLogSearch] = useState("");

  useEffect(() => {
    if (!open || !executionId) return;
    
    setLoading(true);
    setError(null);
    setLogs([]);
    setMessageLogs([]);
    setDetails(null);

    // Fetch initial execution details
    fetch(`/api/${engine}/runs/${executionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch execution details");
        return res.json();
      })
      .then((data) => {
        setDetails(data);
        if (data.status === "running") {
          startLogStream();
        }
      })
      .catch((err) => {
        console.error("Failed to fetch execution details:", err);
        setError("Failed to fetch execution details");
      })
      .finally(() => {
      setLoading(false);
      });
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [open, executionId, engine]);

  useEffect(() => {
    if (messageLogsEndRef.current) {
      messageLogsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageLogs]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const startLogStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/${engine}/runs/${executionId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      // Each event.data is a plain log line
      const line = event.data;
      setLogs((prev) => [...prev, line]);
      if (line.startsWith("Prompt:")) {
        setMessageLogs((prev) => [...prev, line]);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection failed");
      eventSource.close();
      eventSourceRef.current = null;
      setError("Lost connection to log stream");
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const filteredLogs = logs.filter((line) =>
    logSearch.trim() === "" ? true : line.toLowerCase().includes(logSearch.toLowerCase())
  );

  const handleExportLogs = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${executionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMessageLogs = messageLogs.filter((line) =>
    messageLogSearch.trim() === "" ? true : line.toLowerCase().includes(messageLogSearch.toLowerCase())
  );

  const handleExportMessageLogs = () => {
    const blob = new Blob([messageLogs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `message-logs-${executionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Execution Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {details && (
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <span className={getStatusColor(details.status)}>
                    {details.status.charAt(0).toUpperCase() + details.status.slice(1)}
                  </span>
                              </div>
                <div className="text-sm text-gray-500">
                  Started: {new Date(details.startTime).toLocaleString()}
                  {details.endTime && ` • Ended: ${new Date(details.endTime).toLocaleString()}`}
                              </div>
                              </div>
                            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="message-logs">Message Logs</TabsTrigger>
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
              </TabsList>

              <TabsContent value="logs">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1"
                  />
                  <button
                    className="ml-2 p-1 rounded hover:bg-blue-100"
                    title="Export logs"
                    onClick={handleExportLogs}
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                  </button>
                </div>
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  {filteredLogs.length === 0 && details?.logs ? (
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{details.logs}</pre>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No logs available</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLogs.map((line, i) => {
                        let color = "text-gray-700";
                        if (/error/i.test(line)) color = "text-red-500";
                        else if (/warn/i.test(line)) color = "text-yellow-600";
                        else if (/info/i.test(line)) color = "text-blue-600";
                        return (
                          <div key={i} className={`flex items-center gap-2`}>
                            <span className="text-xs text-gray-400 w-8">#{i + 1}</span>
                            <span className={`text-sm whitespace-pre-line flex-1 ${color}`}>{line}</span>
                            <button
                              className="ml-2 p-1 rounded hover:bg-blue-100"
                              title="Copy log"
                              onClick={() => navigator.clipboard.writeText(line)}
                            >
                              <Copy className="w-4 h-4 text-blue-500" />
                            </button>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                </div>
              )}
            </ScrollArea>
          </TabsContent>

              <TabsContent value="message-logs">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search message logs..."
                    value={messageLogSearch}
                    onChange={e => setMessageLogSearch(e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1"
                  />
                  <button
                    className="ml-2 p-1 rounded hover:bg-blue-100"
                    title="Export message logs"
                    onClick={handleExportMessageLogs}
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                  </button>
                            </div>
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  {filteredMessageLogs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No message logs available</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredMessageLogs.map((line, i) => {
                        const message = line.replace(/^Prompt:\s*/, "");
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-8">#{i + 1}</span>
                            <span className="text-sm text-blue-700 whitespace-pre-line flex-1">{message}</span>
                            <button
                              className="ml-2 p-1 rounded hover:bg-blue-100"
                              title="Copy message"
                              onClick={() => navigator.clipboard.writeText(message)}
                            >
                              <Copy className="w-4 h-4 text-blue-500" />
                            </button>
                          </div>
                        );
                      })}
                      <div ref={messageLogsEndRef} />
                </div>
              )}
            </ScrollArea>
          </TabsContent>

              <TabsContent value="input">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <pre className="text-sm">
                    {details?.input
                      ? JSON.stringify(details.input, null, 2)
                      : "No input data available"}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="output">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  {typeof details?.output === 'string' ? (
                    <pre className="text-sm whitespace-pre-wrap">{details.output}</pre>
                  ) : details?.output ? (
                    <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(details.output, null, 2)}</pre>
                  ) : details?.error ? (
                    <pre className="text-sm whitespace-pre-wrap">{details.error}</pre>
                  ) : (
                    <div className="text-center text-gray-500 py-8">No output data available</div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}