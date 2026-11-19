"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.status === "success") {
        localStorage.setItem("token", data.token);
        router.push("/dashboard");
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4 font-sans">
      <form onSubmit={handleLogin} className="max-w-md w-full bg-[#121214] border border-gray-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-6">🔑 Login to EdTech Pro</h2>
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1">Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full p-3 bg-[#09090b] border border-gray-800 rounded-xl text-white font-medium" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 bg-[#09090b] border border-gray-800 rounded-xl text-white font-medium" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-[#4b2ee5] hover:bg-[#311b92] text-white font-bold py-3 rounded-xl shadow-lg transition-all">
          {loading ? "Logging in..." : "Login 🚀"}
        </button>
      </form>
    </div>
  );
}