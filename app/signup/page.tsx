"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError(data.error || "Signup failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500">
      <div className="glass dark:glass-dark p-10 rounded-3xl shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Sign Up for Flowbit</h1>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="px-4 py-3 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-flowbit-teal"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="px-4 py-3 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-flowbit-teal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="px-4 py-3 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-flowbit-teal"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          <button
            type="submit"
            className="mt-2 px-6 py-3 rounded-lg bg-flowbit-blue text-white font-bold shadow-lg hover:bg-flowbit-deep transition"
            disabled={loading}
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        {error && <div className="mt-4 text-red-600 text-center text-sm">{error}</div>}
        {success && <div className="mt-4 text-green-600 text-center text-sm">Signup successful! Redirecting...</div>}
        <p className="mt-6 text-center text-gray-500">Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login</Link></p>
      </div>
    </div>
  );
} 