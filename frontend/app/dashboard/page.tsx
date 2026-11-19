"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentScreen, setCurrentScreen] = useState<"CATEGORIES" | "SERIES" | "TESTS">("CATEGORIES");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<"MOCK" | "PYQ">("PYQ");
  const [subTab, setSubTab] = useState<"FULL" | "SECTIONAL">("SECTIONAL");
  const [yearFilter, setYearFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetch(`${API_BASE_URL}/api/tests/`, {
      method: "GET",
      headers: { "Authorization": "Token " + token, "Content-Type": "application/json" }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") setTests(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const seriesTests = useMemo(() => {
    if (!selectedSeries) return [];
    return tests.filter(t => t.exam_category === selectedSeries);
  }, [tests, selectedSeries]);

  const pyqCount = seriesTests.filter(t => t.test_type.includes("PYQ")).length;
  const mockCount = seriesTests.length - pyqCount;
  
  const mainTabTests = useMemo(() => {
    return seriesTests.filter(t => mainTab === "PYQ" ? t.test_type.includes("PYQ") : !t.test_type.includes("PYQ"));
  }, [seriesTests, mainTab]);

  const fullCount = mainTabTests.filter(t => t.test_type.includes("Full")).length;
  const sectionalCount = mainTabTests.filter(t => t.test_type.includes("Sectional")).length;
  
  const subTabTests = useMemo(() => {
    return mainTabTests.filter(t => subTab === "FULL" ? t.test_type.includes("Full") : t.test_type.includes("Sectional"));
  }, [mainTabTests, subTab]);

  const countAllYears = subTabTests.length;
  const count2026 = subTabTests.filter(t => t.title.includes("2026")).length;
  const count2025 = subTabTests.filter(t => t.title.includes("2025")).length;
  
  const yearTests = useMemo(() => {
    return subTabTests.filter(t => yearFilter === "All" ? true : t.title.includes(yearFilter));
  }, [subTabTests, yearFilter]);

  const countMaths = yearTests.filter(t => t.title.includes("Quantitative") || t.title.includes("Math")).length;
  const countReasoning = yearTests.filter(t => t.title.includes("Reasoning") || t.title.includes("Intelligence")).length;
  const countEnglish = yearTests.filter(t => t.title.includes("English")).length;
  const countGK = yearTests.filter(t => t.title.includes("General Awareness") || t.title.includes("General Knowledge")).length;
  const countAllSubjects = yearTests.length;
  
  const finalFilteredTests = useMemo(() => {
    let filtered = yearTests;
    if (subTab === "SECTIONAL" && subjectFilter !== "All") {
        filtered = yearTests.filter(t => {
            if (subjectFilter === "Maths") return t.title.includes("Quantitative") || t.title.includes("Math");
            if (subjectFilter === "Reasoning") return t.title.includes("Reasoning") || t.title.includes("Intelligence");
            if (subjectFilter === "English") return t.title.includes("English");
            if (subjectFilter === "GK") return t.title.includes("General Awareness") || t.title.includes("General Knowledge");
            return true;
        });
    }

    return [...filtered].sort((a, b) => {
        const dateRegex = /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/;
        const matchA = a.title.match(dateRegex);
        const matchB = b.title.match(dateRegex);
        if (!matchA || !matchB) return 0;
        return new Date(matchA[0]).getTime() - new Date(matchB[0]).getTime();
    });
  }, [yearTests, subTab, subjectFilter]);

  const categories = [{ name: "SSC", icon: "🏛️" }, { name: "Railways", icon: "🚆" }, { name: "Banking", icon: "🏦" }];
  const seriesMap: Record<string, string[]> = {
    "SSC": ["SSC CGL Tier-1", "SSC CGL Tier-2", "SSC CHSL Tier-1", "SSC MTS", "SSC CPO"],
    "Railways": ["RRB NTPC", "RRB Group D", "RRB ALP"],
    "Banking": ["Banking IBPS/SBI PO Prelims"],
    "DEFAULT": ["General Exam"]
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading... ⏳</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col">
      {currentScreen === "CATEGORIES" && (
        <>
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#09090b]">
            <h1 className="text-xl font-bold">Mohit Baghel</h1>
            <Link href="/admin"><button className="bg-[#1e1e2e] text-[#a394e6] px-4 py-1.5 rounded-full text-xs font-bold border border-[#311b92]">Admin Panel</button></Link>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {categories.map((cat, idx) => (
              <button key={idx} onClick={() => { setSelectedCategory(cat.name); setCurrentScreen("SERIES"); }}
                className="bg-[#121214] border border-gray-800 rounded-2xl p-4 flex justify-between items-center hover:bg-[#1a1a1f]">
                <span className="font-bold text-sm text-gray-200">{cat.name}</span>
                <span className="text-2xl">{cat.icon}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {currentScreen === "SERIES" && (
        <>
          <div className="p-4 border-b border-gray-800 flex items-center space-x-4">
            <button onClick={() => setCurrentScreen("CATEGORIES")} className="text-xl font-bold text-gray-400">←</button>
            <h1 className="text-xl font-bold">Test Series</h1>
          </div>
          <div className="p-4 space-y-3">
            {(seriesMap[selectedCategory || ""] || seriesMap["DEFAULT"]).map((series, idx) => (
              <button key={idx} onClick={() => { setSelectedSeries(series); setCurrentScreen("TESTS"); }}
                className="w-full bg-[#121214] border border-gray-800 rounded-xl p-4 flex justify-between items-center hover:bg-[#1a1a1f]">
                <h3 className="font-bold text-gray-100">{series} Series</h3>
                <span>›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {currentScreen === "TESTS" && (
        <>
          <div className="p-4 border-b border-gray-800 flex items-center space-x-4 sticky top-0 bg-[#09090b] z-30">
            <button onClick={() => setCurrentScreen("SERIES")} className="text-xl font-bold text-gray-400">←</button>
            <h1 className="text-lg font-bold">{selectedSeries}</h1>
          </div>
          <div className="flex border-b border-gray-800">
            <button onClick={() => setMainTab("MOCK")} className={`flex-1 py-3 text-sm font-bold ${mainTab === "MOCK" ? "text-[#4b2ee5] border-b-2 border-[#4b2ee5]" : "text-gray-500"}`}>Mock Tests ({mockCount})</button>
            <button onClick={() => setMainTab("PYQ")} className={`flex-1 py-3 text-sm font-bold ${mainTab === "PYQ" ? "text-[#4b2ee5] border-b-2 border-[#4b2ee5]" : "text-gray-500"}`}>Previous Year ({pyqCount})</button>
          </div>
          <div className="flex border-b border-gray-800">
            <button onClick={() => {setSubTab("FULL"); setSubjectFilter("All");}} className={`flex-1 py-3 text-xs font-bold ${subTab === "FULL" ? "text-white bg-[#1e1e2e]" : "text-gray-500"}`}>Full Tests ({fullCount})</button>
            <button onClick={() => setSubTab("SECTIONAL")} className={`flex-1 py-3 text-xs font-bold ${subTab === "SECTIONAL" ? "text-white bg-[#1e1e2e]" : "text-gray-500"}`}>Sectional Tests ({sectionalCount})</button>
          </div>
          <div className="p-4 space-y-4">
            {subTab === "SECTIONAL" && (
              <div className="flex space-x-2 overflow-x-auto pb-3 border-b border-gray-800">
                 <button onClick={() => setSubjectFilter("All")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subjectFilter === "All" ? "text-[#a394e6] bg-[#311b92]/30" : "text-gray-400"}`}>All ({countAllSubjects})</button>
                 <button onClick={() => setSubjectFilter("Maths")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subjectFilter === "Maths" ? "text-[#a394e6] bg-[#311b92]/30" : "text-gray-400"}`}>Maths ({countMaths})</button>
                 <button onClick={() => setSubjectFilter("Reasoning")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subjectFilter === "Reasoning" ? "text-[#a394e6] bg-[#311b92]/30" : "text-gray-400"}`}>Reasoning ({countReasoning})</button>
                 <button onClick={() => setSubjectFilter("English")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subjectFilter === "English" ? "text-[#a394e6] bg-[#311b92]/30" : "text-gray-400"}`}>English ({countEnglish})</button>
                 <button onClick={() => setSubjectFilter("GK")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${subjectFilter === "GK" ? "text-[#a394e6] bg-[#311b92]/30" : "text-gray-400"}`}>GK ({countGK})</button>
              </div>
            )}
            {finalFilteredTests.length === 0 ? (
              <div className="text-center p-8 bg-[#121214] border border-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm">No tests found for this section yet.</p>
              </div>
            ) : (
              finalFilteredTests.map((test) => (
                <div key={test.id} className="bg-[#121214] border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-sm text-gray-200 w-3/4">{test.title}</h3>
                    <button onClick={() => router.push(`/attempt/${test.id}`)} className="bg-[#4b2ee5] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-[#311b92]">
                      {test.attempt_status === "Resume" ? "Resume Test" : "Start Now"}
                    </button>
                  </div>
                  <div className="flex items-center text-xs text-gray-400 space-x-3 bg-[#09090b] p-2.5 rounded-lg border border-gray-800">
                    <span>⏱ {test.time_limit} Min</span><span>|</span><span>📝 25 Ques</span><span>|</span><span className="text-green-500 font-bold">50 Marks</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}