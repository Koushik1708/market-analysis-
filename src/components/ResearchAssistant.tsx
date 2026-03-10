import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Send, Loader2, Sparkles, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { AppDocument } from '../types';

interface ResearchAssistantProps {
  documents: AppDocument[];
}

const ResearchAssistant: React.FC<ResearchAssistantProps> = ({ documents }) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedDoc || isAnalyzing) return;

    const userQuery = query;
    setQuery('');
    setChatHistory(prev => [...prev, { role: 'user', content: userQuery }]);
    setIsAnalyzing(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key missing. Please set VITE_GEMINI_API_KEY in the .env file.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const model = "gemini-3-flash-preview";
      
      const systemInstruction = `You are a professional financial research assistant. 
      You are analyzing a document named "${selectedDoc.name}". 
      The content of the document is provided below. 
      Answer the user's questions based ONLY on the provided document content. 
      If the information is not in the document, say so.
      
      DOCUMENT CONTENT:
      ${selectedDoc.content.substring(0, 30000)} // Limit to 30k chars for safety
      `;

      const response = await ai.models.generateContent({
        model,
        contents: userQuery,
        config: {
          systemInstruction,
        }
      });

      const answer = response.text || "I couldn't generate an answer. Please try again.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      console.error("AI Error:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Error: Failed to connect to the research engine. Please check your connection." }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (documents.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div 
        className="p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Research Assistant</h2>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">AI-Powered Document Analysis</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="text-zinc-400" /> : <ChevronDown className="text-zinc-400" />}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-100"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Sidebar: Document List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Select Document</h3>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        selectedDocId === doc.id 
                        ? 'bg-purple-50 border-purple-200 text-purple-900' 
                        : 'bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <FileText className={`w-4 h-4 ${selectedDocId === doc.id ? 'text-purple-600' : 'text-zinc-400'}`} />
                      <div className="truncate">
                        <p className="text-sm font-semibold truncate">{doc.name}</p>
                        <p className="text-[10px] opacity-60 uppercase">{doc.type} • {(doc.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main: Chat Interface */}
              <div className="lg:col-span-2 flex flex-col h-[500px] bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-purple-600" />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900">Ask anything about your documents</h4>
                      <p className="text-sm text-zinc-500 max-w-xs mt-2">
                        Select a document from the left and ask questions like "What are the key risks mentioned?" or "Summarize the financial outlook."
                      </p>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user' 
                          ? 'bg-purple-600 text-white rounded-tr-none' 
                          : 'bg-white text-zinc-800 border border-zinc-100 shadow-sm rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))
                  )}
                  {isAnalyzing && (
                    <div className="flex justify-start">
                      <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        <span className="text-sm text-zinc-500 font-medium">Analyzing document...</span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAsk} className="p-4 bg-white border-t border-zinc-100 flex gap-2">
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={selectedDoc ? `Ask about ${selectedDoc.name}...` : "Select a document first"}
                    disabled={!selectedDoc || isAnalyzing}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={!query.trim() || !selectedDoc || isAnalyzing}
                    className="w-12 h-12 bg-purple-600 hover:bg-purple-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default ResearchAssistant;
