"use client";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setLoading(false);
    if (res?.ok) {
      router.push("/dashboard");
    } else {
      setError("Invalid email or password");
    }
  }

  // Show error from NextAuth query param
  const urlError = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500">
      <div className="glass dark:glass-dark p-10 rounded-3xl shadow-2xl max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Login to Flowbit</h1>
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
          <button
            type="submit"
            className="mt-2 px-6 py-3 rounded-lg bg-flowbit-blue text-white font-bold shadow-lg hover:bg-flowbit-deep transition"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        {(error || urlError) && (
          <div className="mt-4 text-red-600 text-center text-sm">{error || "Invalid email or password"}</div>
        )}
        <p className="mt-6 text-center text-gray-500">Don't have an account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link></p>
      </div>
    </div>
  );
} 