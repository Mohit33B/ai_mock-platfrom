"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

const CATEGORY_EXAM_MAP: Record<string, { name: string; subjects: string[] }[]> = {
  "SSC": [
    { name: "SSC CGL Tier-1", subjects: ["General Intelligence and Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension"] },
    { name: "SSC CGL Tier-2", subjects: ["Mathematical Abilities", "Reasoning and General Intelligence", "English Language", "General Awareness", "Computer Knowledge"] },
    { name: "SSC CHSL Tier-1", subjects: ["English Language", "General Intelligence", "Quantitative Aptitude", "General Awareness"] },
    { name: "SSC MTS", subjects: ["Numerical and Mathematical Ability", "Reasoning Ability", "General Awareness", "English Language"] },
    { name: "SSC CPO", subjects: ["General Intelligence and Reasoning", "General Knowledge", "Quantitative Aptitude", "English Comprehension"] }
  ],
  "Railways": [
    { name: "RRB NTPC", subjects: ["Mathematics", "General Intelligence and Reasoning", "General Awareness"] },
    { name: "RRB Group D", subjects: ["Mathematics", "General Intelligence and Reasoning", "General Science", "General Awareness"] },
    { name: "RRB ALP", subjects: ["Mathematics", "General Intelligence and Reasoning", "Basic Science and Engineering", "General Awareness"] }
  ],
  "Banking": [
    { name: "Banking IBPS/SBI PO Prelims", subjects: ["English Language", "Quantitative Aptitude", "Reasoning Ability"] }
  ],
  "Police": [
    { name: "UP Police Constable", subjects: ["General Knowledge", "General Hindi", "Numerical and Mental Ability", "Mental Aptitude"] },
    { name: "Delhi Police Constable", subjects: ["Reasoning", "General Knowledge", "Numerical Ability", "Computer Fundamentals"] }
  ]
};

export default function AdminMockBuilder() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"UPLOAD" | "MERGE">("UPLOAD");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [examCategory, setExamCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [sectionalTime, setSectionalTime] = useState<number | "">("");
  const [jsonFileContent, setJsonFileContent] = useState("");
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setExamCategory("");
    setSubject("");
    setSectionalTime("");
  };

  const handleExamChange = (exam: string) => {
    setExamCategory(exam);
    setSubject("");
    setSectionalTime("");
  };

  const handleSubjectChange = (sub: string) => {
    setSubject(sub);
    if (sub) setSectionalTime(15);
  };

  const inputClass = "w-full p-3 border border-gray-300 rounded-lg text-black bg-white focus:outline-none font-medium";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setJsonFileContent(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleJsonUpload = async () => {
    if (!examCategory || !subject || !sectionalTime || !jsonFileContent) {
      return alert("Please select Category, Exam, Subject, Time and JSON file!");
    }

    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/upload-json-bank/`, {
        method: "POST",
        headers: { "Authorization": "Token " + (token || ""), "Content-Type": "application/json" },
        body: JSON.stringify({ json_data: jsonFileContent, subject, exam_category: examCategory, time_limit: sectionalTime })
      });
      const data = await res.json();
      if (data.status === "success") {
        setJsonFileContent("");
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
        alert("✅ " + data.message);
      }
      else alert("❌ Error: " + data.error);
    } catch (err: any) { alert("Error: " + err.message); }
    setLoading(false);
  };

  const handleMergeFullMocks = async () => {
    if (!examCategory) return alert("Please select an Exam Category to merge!");
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/merge_to_full_mock/`, {
        method: "POST",
        headers: { "Authorization": "Token " + (token || ""), "Content-Type": "application/json" },
        body: JSON.stringify({ exam_category: examCategory })
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("🎉 " + data.message);
        router.push("/dashboard");
      } else alert("❌ Error: " + data.message);
    } catch (err: any) { alert("Network Error."); }
    setLoading(false);
  };

  const availableExams = selectedCategory ? CATEGORY_EXAM_MAP[selectedCategory] || [] : [];
  const selectedExamObj = availableExams.find(e => e.name === examCategory);
  const availableSubjects = selectedExamObj ? selectedExamObj.subjects : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          {/* Header & Tabs */}
          <div className="flex justify-between items-center mb-6 border-b pb-4">
             <h2 className="text-2xl font-bold text-gray-900">🛠️ Ultimate Exam Admin</h2>
             <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('UPLOAD')} className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === 'UPLOAD' ? 'bg-[#311b92] text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Upload 📁</button>
                <button onClick={() => setActiveTab('MERGE')} className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === 'MERGE' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>Merge Full Mock 🧩</button>
             </div>
          </div>

          {activeTab === 'UPLOAD' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Select Category</label>
                  <select className={inputClass} value={selectedCategory} onChange={e => handleCategoryChange(e.target.value)}>
                    <option value="">-- Choose Category --</option>
                    {Object.keys(CATEGORY_EXAM_MAP).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Select Exam Rule</label>
                  <select className={inputClass} value={examCategory} onChange={e => handleExamChange(e.target.value)} disabled={!selectedCategory}>
                    <option value="">-- Choose Exam --</option>
                    {availableExams.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Subject</label>
                  <select className={inputClass} value={subject} onChange={e => handleSubjectChange(e.target.value)} disabled={!examCategory}>
                    <option value="">-- Choose Subject --</option>
                    {availableSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-800 mb-2">Sectional Time (Mins)</label>
                   <input type="number" className={inputClass} value={sectionalTime} onChange={e => setSectionalTime(e.target.value ? Number(e.target.value) : "")} placeholder="15" />
                </div>
              </div>
              
              <div className="border-2 border-dashed border-[#311b92] p-8 rounded-xl bg-purple-50 text-center">
                <input ref={jsonFileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="mb-6 block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200" />
                <button onClick={handleJsonUpload} disabled={loading || !jsonFileContent || !subject} className="w-full bg-[#311b92] text-white font-bold py-4 rounded-lg shadow-lg text-lg disabled:opacity-50 hover:bg-purple-800">
                  {loading ? "Uploading... ⏳" : (subject ? `Generate ${subject} Mocks 🚀` : "Select Category, Exam & Subject First")}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'MERGE' && (
            <div className="text-center p-8 bg-green-50 border-2 border-dashed border-green-600 rounded-xl space-y-4">
               <h3 className="text-2xl font-bold text-green-900">Combine Sectionals into Full Mocks</h3>
               
               <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-left">
                 <div>
                   <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                   <select className={inputClass} value={selectedCategory} onChange={e => handleCategoryChange(e.target.value)}>
                      <option value="">-- Category --</option>
                      {Object.keys(CATEGORY_EXAM_MAP).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-700 mb-1">Exam Rule</label>
                   <select className={inputClass} value={examCategory} onChange={e => handleExamChange(e.target.value)} disabled={!selectedCategory}>
                      <option value="">-- Exam --</option>
                      {availableExams.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                   </select>
                 </div>
               </div>

               <p className="text-xs text-gray-600 font-medium">
                 {examCategory ? (
                   <>Required Subjects: <span className="text-red-600 font-bold">{selectedExamObj?.subjects.join(" | ")}</span></>
                 ) : "Pehle category aur exam select karein."}
               </p>
               
               <button onClick={handleMergeFullMocks} disabled={loading || !examCategory} className="w-full max-w-md bg-green-600 text-white font-bold py-4 rounded-lg shadow-lg text-lg disabled:opacity-50 hover:bg-green-700">
                  {loading ? "Merging Rules Engine... ⏳" : "Create Full Mocks Now ✨"}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}