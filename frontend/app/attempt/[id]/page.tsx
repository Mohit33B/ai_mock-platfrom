"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

export default function TestAttempt() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id;

  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testStarted, setTestStarted] = useState(false);
  const [agreed, setAgreed] = useState(false);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });
  const [preferredLanguage, setPreferredLanguage] = useState<"Hindi" | "English">("Hindi");
  
  const [timeLeft, setTimeLeft] = useState(15 * 60); 
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"SCORECARD" | "SOLUTIONS">("SCORECARD");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetch(`${API_BASE_URL}/api/tests/${testId}/`, {
      method: "GET",
      headers: { "Authorization": "Token " + token, "Content-Type": "application/json" }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setTestData(data.data);
          if (data.data.time_limit) setTimeLeft(data.data.time_limit * 60);
          if (data.data.saved_progress) {
            const prog = data.data.saved_progress;
            if (prog.saved_answers) setSelectedAnswers(prog.saved_answers);
            if (prog.marked_for_review) setMarkedForReview(prog.marked_for_review);
            if (prog.current_index) setCurrentIndex(prog.current_index);
            if (prog.time_left) setTimeLeft(prog.time_left);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [testId, router]);

  const triggerAutoSave = (answers: Record<number, string>, marked: Record<number, boolean>, idx: number, time: number) => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/api/tests/${testId}/autosave/`, {
      method: "POST",
      headers: { "Authorization": "Token " + (token || ""), "Content-Type": "application/json" },
      body: JSON.stringify({ answers, marked, current_index: idx, time_left: time })
    }).catch(() => {});
  };

  useEffect(() => {
    if (!testStarted || resultData) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [testStarted, resultData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isPlaceholderText = (text: string): boolean => {
    const cleaned = text.trim();
    if (!cleaned) return true;
    const lower = cleaned.toLowerCase();
    return lower === "refer to the given options below"
      || lower.includes("see figure/question")
      || /\boption\s*[a-d]\s*\(see figure\/question\)\b/.test(lower)
      || lower === "question text unavailable";
  };

  const splitBilingualText = (text: string): { english: string; hindi: string } => {
    const trimmed = text.trim();
    if (!trimmed || isPlaceholderText(trimmed)) {
      return { english: "", hindi: "" };
    }
    if (!/[A-Za-z]/.test(trimmed) || !/[\u0900-\u097F]/.test(trimmed)) {
      return { english: trimmed, hindi: "" };
    }

    const hindiIndex = trimmed.search(/[\u0900-\u097F]/);
    if (hindiIndex <= 0) {
      return { english: "", hindi: trimmed };
    }

    return {
      english: trimmed.slice(0, hindiIndex).trim().replace(/[\s\-:;,.()\[\]{}]+$/, ""),
      hindi: trimmed.slice(hindiIndex).trim().replace(/^[\s\-:;,.()\[\]{}]+/, "")
    };
  };

  const getLocalizedText = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") {
      if (isPlaceholderText(value)) return "";
      const { english, hindi } = splitBilingualText(value);
      return preferredLanguage === "Hindi" ? (hindi || english) : (english || hindi);
    }
    if (Array.isArray(value)) return value.map((item) => getLocalizedText(item)).filter(Boolean).join(" ");
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const english = obj.english ?? obj.en ?? obj.text ?? obj.value;
      const hindi = obj.hindi ?? obj.hi ?? obj.hn;
      const englishText = typeof english === "string" ? splitBilingualText(english).english || english : getLocalizedText(english);
      const hindiText = typeof hindi === "string" ? splitBilingualText(hindi).hindi || hindi : getLocalizedText(hindi);
      const selected = preferredLanguage === "Hindi" ? (hindiText || englishText) : (englishText || hindiText);
      if (selected) return String(selected);
      return Object.values(obj)
        .map((item) => getLocalizedText(item))
        .filter(Boolean)
        .join(" ");
    }
    return String(value);
  };

  const getLocalizedOptionText = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") {
      if (isPlaceholderText(value)) return "";
      const { english, hindi } = splitBilingualText(value);
      return preferredLanguage === "Hindi" ? (hindi || english) : (english || hindi);
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const english = obj.english ?? obj.en ?? obj.text ?? obj.value;
      const hindi = obj.hindi ?? obj.hi ?? obj.hn;
      const englishText = typeof english === "string" ? splitBilingualText(english).english || english : getLocalizedText(english);
      const hindiText = typeof hindi === "string" ? splitBilingualText(hindi).hindi || hindi : getLocalizedText(hindi);
      return preferredLanguage === "Hindi" ? (hindiText || englishText) : (englishText || hindiText);
    }
    return String(value);
  };

  const handleOptionSelect = (optionKey: string) => {
    const updated = { ...selectedAnswers, [currentIndex]: optionKey };
    setSelectedAnswers(updated);
    triggerAutoSave(updated, markedForReview, currentIndex, timeLeft);
  };

  const handleSaveAndNext = () => {
    const updatedVisited = { ...visited, [currentIndex]: true };
    setVisited(updatedVisited);
    triggerAutoSave(selectedAnswers, markedForReview, currentIndex, timeLeft);
    if (currentIndex < (testData?.questions_data?.length || 0) - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleMarkForReviewAndNext = () => {
    const updatedMarked = { ...markedForReview, [currentIndex]: true };
    setMarkedForReview(updatedMarked);
    setVisited({ ...visited, [currentIndex]: true });
    triggerAutoSave(selectedAnswers, updatedMarked, currentIndex, timeLeft);
    if (currentIndex < (testData?.questions_data?.length || 0) - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleClearResponse = () => {
    const updatedAnswers = { ...selectedAnswers };
    delete updatedAnswers[currentIndex];
    setSelectedAnswers(updatedAnswers);
    triggerAutoSave(updatedAnswers, markedForReview, currentIndex, timeLeft);
  };

  const handleSubmitTest = async () => {
    if (submitting || resultData) return;
    setSubmitting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/tests/${testId}/submit/`, {
        method: "POST",
        headers: { "Authorization": "Token " + (token || ""), "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers })
      });
      const data = await res.json();
      if (data.status === "success") setResultData(data.data);
      else alert("Submission failed: " + (data.error || "Unknown"));
    } catch (err: any) { alert("Network Error: " + err.message); }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Loading Test... ⏳</div>;
  if (!testData) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">Test not found! ❌</div>;

  const questions = testData.questions_data || [];
  const currentQ = questions[currentIndex];

  // ================= POST-TEST SCORECARD & SOLUTIONS DASHBOARD =================
  if (resultData) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white font-sans p-6 flex flex-col items-center justify-center">
        {viewMode === "SCORECARD" ? (
          <div className="max-w-xl w-full bg-[#121214] border border-gray-800 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
            <div className="text-5xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold">Post-Test Analysis & Scorecard</h2>
            
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-[#09090b] p-4 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400">Total Score</p>
                <p className="text-2xl font-bold text-[#4b2ee5]">{resultData.score} Marks</p>
              </div>
              <div className="bg-[#09090b] p-4 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400">Accuracy Rate</p>
                <p className="text-2xl font-bold text-green-500">{resultData.accuracy?.toFixed(1)}%</p>
              </div>
              <div className="bg-[#09090b] p-4 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400">Correct Answers</p>
                <p className="text-xl font-bold text-green-400">{resultData.correct}</p>
              </div>
              <div className="bg-[#09090b] p-4 rounded-xl border border-gray-800">
                <p className="text-xs text-gray-400">Incorrect Answers</p>
                <p className="text-xl font-bold text-red-400">{resultData.wrong}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setViewMode("SOLUTIONS")} className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 rounded-xl transition-all">
                View Solutions 📚
              </button>
              <button onClick={() => window.location.reload()} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-3 rounded-xl transition-all">
                Re-attempt Test 🔄
              </button>
            </div>

            <button onClick={() => router.push("/dashboard")} className="w-full bg-[#4b2ee5] hover:bg-[#311b92] text-white font-bold py-3 rounded-xl transition-all">
              Back to Dashboard 🏠
            </button>
          </div>
        ) : (
          /* ================= SOLUTIONS PANEL ================= */
          <div className="max-w-4xl w-full bg-[#121214] border border-gray-800 rounded-2xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h2 className="text-xl font-bold">Solutions & Explanations</h2>
              <button onClick={() => setViewMode("SCORECARD")} className="bg-gray-800 text-gray-300 px-4 py-1.5 rounded-lg text-xs font-bold">← Back to Scorecard</button>
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {questions.map((q: any, idx: number) => {
                const userAns = selectedAnswers[idx];
                const correctAns = q.correct_answer;
                const isCorrect = userAns === correctAns;
                
                return (
                  <div key={idx} className="bg-[#09090b] border border-gray-800 p-5 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-xs text-gray-400 font-bold">
                      <span>Question {idx + 1}</span>
                      <span className={isCorrect ? "text-green-400" : "text-red-400"}>
                        {userAns ? (isCorrect ? "✅ Correct" : "❌ Incorrect") : "⚠️ Unattempted"}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-gray-100 space-y-1">
                      <p>{getLocalizedText(q.question || q.question_text || "") || "Question text unavailable."}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {q.options && Object.entries(q.options).map(([optKey, optVal]: [string, any]) => {
                        const optionText = getLocalizedOptionText(optVal);
                        if (!optionText) return null;

                        let badgeColor = "bg-[#121214] text-gray-300 border-gray-800";
                        if (optKey.toUpperCase() === correctAns.toUpperCase()) badgeColor = "bg-green-900/40 border-green-600 text-green-300";
                        else if (optKey.toUpperCase() === userAns?.toUpperCase()) badgeColor = "bg-red-900/40 border-red-600 text-red-300";

                        return (
                          <div key={optKey} className={`p-3 rounded-lg border flex items-center space-x-3 ${badgeColor}`}>
                            <span className="font-bold">{optKey.toUpperCase()}.</span>
                            <span>{optionText}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs bg-[#121214] p-3 rounded-lg border border-gray-800 text-gray-400">
                      <span className="font-bold text-[#a394e6]">Explanation: </span> 
                      Correct Option is <strong className="text-green-400">{correctAns}</strong>. {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= INSTRUCTIONS SCREEN =================
  if (!testStarted) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center space-x-4 bg-[#121214]">
          <button onClick={() => router.push("/dashboard")} className="text-2xl font-bold text-gray-400">←</button>
          <h1 className="text-lg font-bold truncate">{testData.title} - Instructions</h1>
        </div>
        <div className="max-w-4xl mx-auto p-6 space-y-6 flex-1 w-full overflow-y-auto">
          <div className="bg-[#121214] border border-gray-800 rounded-2xl p-6 space-y-4 text-sm text-gray-300">
            <h2 className="text-xl font-bold text-white mb-2">1. Basic Exam Rules</h2>
            <p>• Timer top-right corner par chalega aur zero hone par auto-submit ho jayega.</p>
            <h2 className="text-xl font-bold text-white mt-4 mb-2">2. Palette Status Codes</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 bg-[#09090b] p-2 rounded"><span className="w-3 h-3 bg-gray-600 rounded"></span> Not Visited</div>
              <div className="flex items-center gap-2 bg-[#09090b] p-2 rounded"><span className="w-3 h-3 bg-red-600 rounded"></span> Not Answered</div>
              <div className="flex items-center gap-2 bg-[#09090b] p-2 rounded"><span className="w-3 h-3 bg-green-600 rounded"></span> Answered</div>
              <div className="flex items-center gap-2 bg-[#09090b] p-2 rounded"><span className="w-3 h-3 bg-purple-600 rounded"></span> Marked for Review</div>
            </div>
          </div>
          <div className="bg-[#121214] border border-gray-800 rounded-xl p-4 flex items-start space-x-3">
            <input type="checkbox" id="declaration" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 accent-[#4b2ee5]" />
            <label htmlFor="declaration" className="text-xs text-gray-400">Maine sabhi nirdesho ko padh aur samajh liya hai.</label>
          </div>
          <button onClick={() => setTestStarted(true)} disabled={!agreed} className={`w-full py-4 rounded-xl text-lg font-bold ${agreed ? "bg-[#4b2ee5] text-white" : "bg-gray-800 text-gray-500 opacity-50"}`}>
            I am ready to begin 🚀
          </button>
        </div>
      </div>
    );
  }

  // ================= ACTIVE TEST ATTEMPT INTERFACE =================
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#121214] sticky top-0 z-20">
        <h2 className="font-bold text-sm text-gray-200 truncate">{testData.title}</h2>
        <div className="flex items-center space-x-4">
          <div className="bg-[#09090b] px-3 py-1.5 rounded-lg border border-gray-800 font-mono font-bold text-red-400 text-sm">⏱ {formatTime(timeLeft)}</div>
          <button onClick={handleSubmitTest} disabled={submitting} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Submit Test</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 max-w-7xl mx-auto w-full">
        <div className="flex-1 bg-[#121214] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-[#a394e6] bg-[#311b92]/30 px-3 py-1 rounded-full border border-[#311b92]">Question {currentIndex + 1} of {questions.length}</span>
            <div className="flex justify-end mb-4">
              <div className="inline-flex rounded-lg border border-gray-700 bg-[#09090b] p-1">
                <button onClick={() => setPreferredLanguage("Hindi")} className={`px-3 py-1 rounded-md text-xs font-bold ${preferredLanguage === "Hindi" ? "bg-[#4b2ee5] text-white" : "text-gray-400"}`}>Hindi</button>
                <button onClick={() => setPreferredLanguage("English")} className={`px-3 py-1 rounded-md text-xs font-bold ${preferredLanguage === "English" ? "bg-[#4b2ee5] text-white" : "text-gray-400"}`}>English</button>
              </div>
            </div>
            
            <div className="text-base md:text-lg font-medium text-gray-100 my-6 leading-relaxed space-y-2">
              <p>{getLocalizedText(currentQ?.question || currentQ?.question_text || "") || "Question text not available for this item."}</p>
            </div>

            <div className="space-y-3">
              {currentQ?.options && typeof currentQ.options === 'object' && Object.keys(currentQ.options).length > 0 ? (
                Object.entries(currentQ.options).map(([key, value]: [string, any]) => {
                  const optionText = getLocalizedOptionText(value);
                  if (!optionText) return null;
                  return (
                    <button key={key} onClick={() => handleOptionSelect(key)} className={`w-full p-4 rounded-xl border text-left flex items-center space-x-4 ${selectedAnswers[currentIndex]?.toUpperCase() === key.toUpperCase() ? "bg-[#4b2ee5]/30 border-[#4b2ee5] text-white" : "bg-[#09090b] border-gray-800 text-gray-300"}`}>
                      <span className="w-8 h-8 rounded-full bg-[#1e1e2e] flex items-center justify-center font-bold text-sm">{key.toUpperCase()}</span>
                      <span className="text-sm">{optionText}</span>
                    </button>
                  );
                })
              ) : (
                <p className="text-gray-500">Options not available for this question.</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-800">
            <div className="flex gap-2">
              <button onClick={handleMarkForReviewAndNext} className="bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">Mark for Review & Next</button>
              <button onClick={handleClearResponse} className="bg-gray-800 text-gray-300 px-4 py-2.5 rounded-xl text-xs font-bold">Clear Response</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="bg-[#1e1e2e] text-gray-300 px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-30">Previous</button>
              {currentIndex < questions.length - 1 && <button onClick={handleSaveAndNext} className="bg-[#4b2ee5] text-white px-6 py-2.5 rounded-xl text-xs font-bold">Save & Next</button>}
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 bg-[#121214] border border-gray-800 rounded-2xl p-4 flex flex-col">
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase">Question Palette</h3>
          <div className="grid grid-cols-5 gap-2 overflow-y-auto max-h-96 pr-1 mb-4">
            {questions.map((_: any, idx: number) => {
              const isAnswered = selectedAnswers[idx] !== undefined;
              const isMarked = markedForReview[idx];
              const isVisited = visited[idx];
              const isCurrent = currentIndex === idx;

              let bgClass = "bg-gray-700 text-white";
              if (isVisited && !isAnswered && !isMarked) bgClass = "bg-red-600 text-white";
              if (isAnswered && !isMarked) bgClass = "bg-green-600 text-white";
              if (isMarked && !isAnswered) bgClass = "bg-purple-600 text-white";
              if (isMarked && isAnswered) bgClass = "bg-purple-700 border-2 border-green-400 text-white";

              return (
                <button key={idx} onClick={() => { setCurrentIndex(idx); setVisited(v => ({ ...v, [idx]: true })); }} className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center ${isCurrent ? "ring-2 ring-white" : ""} ${bgClass}`}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}