"use client";

import React, { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function CronEditor() {
  const [jobs, setJobs] = useState([]);
  const [cron, setCron] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [input, setInput] = useState("");

  useEffect(() => {
    fetch("/cron.json")
      .then(res => res.json())
      .then(setJobs);
  }, []);

  const addJob = async () => {
    const newJob = { workflow, cron, input: { text: input } };
    const updated = [...jobs, newJob];
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newJob),
    });
    setJobs(updated);
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Cron Jobs</h2>
      <div className="space-y-2">
        <Input placeholder="Workflow name" value={workflow} onChange={(e) => setWorkflow(e.target.value)} />
        <Input placeholder="CRON expression" value={cron} onChange={(e) => setCron(e.target.value)} />
        <Input placeholder="Input (text)" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button onClick={addJob}>Add Job</Button>
      </div>
      <ul className="mt-4 space-y-2">
        {jobs.map((j, i) => (
          <li key={i} className="text-sm border p-2 rounded">
            <strong>{j.workflow}</strong> → {j.cron}
            <br />
            input: {JSON.stringify(j.input)}
          </li>
        ))}
      </ul>
    </div>
  );
}