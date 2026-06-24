import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Heart,
  Mic,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Download,
  History,
  Play,
  Pause,
  Copy,
  RotateCcw,
  FileText,
  Check,
  Loader2,
  HelpCircle,
  User,
  Plus,
  Trash2,
  Save,
  VolumeX,
} from "lucide-react";
import { VOICE_PROFILES, AUDIO_STYLES, SCRIPT_TEMPLATES } from "./constants";
import { BroadcastScript, VoiceProfile, AudioStyle } from "./types";
import { base64ToArrayBuffer, encodePCMToWAV, formatDate } from "./utils";

export default function App() {
  // State variables
  const [title, setTitle] = useState<string>("每週例行廣播");
  const [rawContent, setRawContent] = useState<string>("");
  const [polishedContent, setPolishedContent] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [selectedStyle, setSelectedStyle] = useState<string>("default");
  
  // Refiner options
  const [refineTone, setRefineTone] = useState<string>("warm");
  const [refineLength, setRefineLength] = useState<string>("keep");

  // App UI states
  const [isPolishing, setIsPolishing] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<string | null>(null); // Voice ID
  
  // Generated Audio state
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);

  // Audio Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Repeats / Pause state (Address User Repeat & Delay Request)
  const [isRepeatEnabled, setIsRepeatEnabled] = useState<boolean>(true); // Enabled by default
  const [repeatTimes, setRepeatTimes] = useState<number>(2); // 2 means play twice (first and second)
  const [currentPlayIndex, setCurrentPlayIndex] = useState<number>(1);
  const [repeatDelay, setRepeatDelay] = useState<number>(5); // default pause 5 seconds
  const [isWaitingForNextPlay, setIsWaitingForNextPlay] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const countdownTimerRef = useRef<any>(null);

  // Notifications & History
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [history, setHistory] = useState<BroadcastScript[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refs for Audio elements
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Helper to completely reset repetition/countdown state of the player
  const resetPlayerState = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setIsWaitingForNextPlay(false);
    setCurrentPlayIndex(1);
    setCountdown(0);
  };

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("ai_broadcast_history");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed);
        // Load the latest script to start with if available
        if (parsed.length > 0) {
          loadScript(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    } else {
      // Load default template first
      setRawContent(SCRIPT_TEMPLATES[0].content);
      setPolishedContent(SCRIPT_TEMPLATES[0].content);
      setSelectedVoice(SCRIPT_TEMPLATES[0].voice);
      setSelectedStyle(SCRIPT_TEMPLATES[0].style);
    }
  }, []);

  // Save history helper
  const saveHistoryToStorage = (newHistory: BroadcastScript[]) => {
    setHistory(newHistory);
    localStorage.setItem("ai_broadcast_history", JSON.stringify(newHistory));
  };

  // Add notification auto-dismisses
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Load templates
  const applyTemplate = (template: typeof SCRIPT_TEMPLATES[0]) => {
    setTitle(template.title.replace(/^[^\w\s\u4e00-\u9fa5]+/, "").trim());
    setRawContent(template.content);
    setPolishedContent(template.content);
    setSelectedVoice(template.voice);
    setSelectedStyle(template.style);
    setRefineTone(template.style);
    resetPlayerState();
    setSuccessMessage(`已套用「${template.title}」範本！`);
  };

  // Load script from history
  const loadScript = (script: BroadcastScript) => {
    setActiveHistoryId(script.id);
    setTitle(script.title);
    setRawContent(script.content);
    setPolishedContent(script.polishedContent || script.content);
    setSelectedVoice(script.voice);
    setSelectedStyle(script.style);
    resetPlayerState();
    
    // Clear current audio playing
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    setGeneratedAudioUrl(null);
    setGeneratedAudioBlob(null);
  };

  // Copy polished text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(polishedContent || rawContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  // Double text repeat tool (append pause & copy text)
  const handleBakeRepeatText = () => {
    const textToRepeat = polishedContent || rawContent;
    if (!textToRepeat.trim()) {
      setErrorMessage("請先輸入您的廣播內容。");
      return;
    }

    if (textToRepeat.includes("【重複複誦】")) {
      setErrorMessage("文稿似乎已經是重複複誦版囉！");
      return;
    }

    const baked = `${textToRepeat}\n\n（稍微靜音停頓 ${repeatDelay} 秒後再次廣播）\n……\n\n${textToRepeat}`;
    setPolishedContent(baked);
    setSuccessMessage(`已在文本中嵌入重複複誦區，並標註停頓 ${repeatDelay} 秒！可以直接點擊「產生」錄製。`);
  };

  // Reset work area
  const handleReset = () => {
    setTitle("每週例行廣播");
    setRawContent("");
    setPolishedContent("");
    setSelectedVoice("Kore");
    setSelectedStyle("default");
    setActiveHistoryId(null);
    setGeneratedAudioUrl(null);
    setGeneratedAudioBlob(null);
    resetPlayerState();
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
    setSuccessMessage("工作區已重設！您可以開始撰寫新的逐字稿。");
  };

  // 1. Call AI Script Polishing API
  const handlePolishScript = async () => {
    if (!rawContent.trim()) {
      setErrorMessage("請先輸入您的原始廣播逐字稿草稿。");
      return;
    }

    setIsPolishing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: rawContent,
          tone: refineTone,
          lengthConstraint: refineLength,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "潤飾逐字稿失敗");
      }

      setPolishedContent(data.polishedText);
      setSelectedStyle(refineTone); // Recommend matching reading style
      setSuccessMessage("AI 智慧口語化潤飾完成！");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(`AI 潤飾時發生錯誤: ${error.message}`);
    } finally {
      setIsPolishing(false);
    }
  };

  // 2. Play Preview Speech (using Gemini Prebuilt Voice Engine)
  const handlePlayVoicePreview = async (voice: VoiceProfile) => {
    // If already playing this preview, stop it
    if (isPlayingPreview === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setIsPlayingPreview(null);
      return;
    }

    setIsPlayingPreview(voice.id);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: `你好，我是 ${voice.name}。我很樂意為您朗讀每週廣播。`,
          voice: voice.id,
          style: "default",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "聲音預聽生成失敗");
      }

      // Convert PCM Base64 to WAV Blob for native HTML Audio playback
      const rawPcm = base64ToArrayBuffer(data.audioBase64);
      const wavBlob = encodePCMToWAV(rawPcm, data.sampleRate || 24000);
      const audioUrl = URL.createObjectURL(wavBlob);

      if (previewAudioRef.current) {
        previewAudioRef.current.src = audioUrl;
        previewAudioRef.current.onended = () => {
          setIsPlayingPreview(null);
        };
        await previewAudioRef.current.play();
      }
    } catch (error: any) {
      console.error("Preview playback error", error);
      setErrorMessage(`無法撥放聲音預試: ${error.message}`);
      setIsPlayingPreview(null);
    }
  };

  // 3. Generate Official Broadcast MP3 (WAV Container)
  const handleGenerateAudio = async () => {
    const textToRead = polishedContent || rawContent;
    if (!textToRead.trim()) {
      setErrorMessage("請輸入或生成您要轉換為語音的廣播逐字稿。");
      return;
    }

    setIsGeneratingAudio(true);
    setErrorMessage(null);

    // Stop current audio playbacks
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToRead,
          voice: selectedVoice,
          style: selectedStyle,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "音訊生成失敗");
      }

      // Convert PCM raw to WAV File format
      const rawPcm = base64ToArrayBuffer(data.audioBase64);
      const wavBlob = encodePCMToWAV(rawPcm, data.sampleRate || 24000);
      const audioUrl = URL.createObjectURL(wavBlob);

      setGeneratedAudioBlob(wavBlob);
      setGeneratedAudioUrl(audioUrl);

      // Save or update to History list
      const newItem: BroadcastScript = {
        id: activeHistoryId || Date.now().toString(),
        title: title || "未命名廣播",
        content: rawContent,
        polishedContent: polishedContent || rawContent,
        voice: selectedVoice,
        style: selectedStyle,
        createdAt: new Date().toISOString(),
      };

      let updatedHistory = [...history];
      const existingIndex = history.findIndex((h) => h.id === newItem.id);

      if (existingIndex > -1) {
        updatedHistory[existingIndex] = newItem;
      } else {
        updatedHistory = [newItem, ...updatedHistory];
      }

      saveHistoryToStorage(updatedHistory);
      setActiveHistoryId(newItem.id);

      setSuccessMessage("🎉 廣播音訊生成成功！已加入下方歷史清單中。");
      resetPlayerState();

      // Auto load into main player
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
      }
    } catch (error: any) {
      console.error("Audio generation error", error);
      setErrorMessage(`生成廣播音訊失敗: ${error.message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // 4. Custom Player Controls
  const togglePlay = () => {
    if (!generatedAudioUrl || !audioRef.current) return;

    if (isPlaying || isWaitingForNextPlay) {
      resetPlayerState();
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If we are starting from the very beginning, reset count to 1
      if (currentTime === 0 && !isWaitingForNextPlay) {
        setCurrentPlayIndex(1);
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        setErrorMessage("無法播放音訊: " + e.message);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    if (isRepeatEnabled && (repeatTimes === -1 || currentPlayIndex < repeatTimes)) {
      setIsWaitingForNextPlay(true);
      setCountdown(repeatDelay);
      setIsPlaying(false);

      let secondsLeft = repeatDelay;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      countdownTimerRef.current = setInterval(() => {
        secondsLeft -= 1;
        setCountdown(secondsLeft);

        if (secondsLeft <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          setIsWaitingForNextPlay(false);
          setCurrentPlayIndex((prev) => prev + 1);
          
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
              setIsPlaying(true);
            }).catch(e => {
              console.error("Auto repeat playback error:", e);
            });
          }
        }
      }, 1000);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentPlayIndex(1);
    }
  };

  const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const downloadWavFile = () => {
    if (!generatedAudioBlob) return;
    const url = URL.createObjectURL(generatedAudioBlob);
    const a = document.createElement("a");
    a.href = url;
    // Format friendly file name with date and voice
    const cleanTitle = title.replace(/[\s\x00-\x1f\x7f<>:"/\\|?*]/g, "_");
    a.download = `${cleanTitle}_${selectedVoice}_${new Date().toISOString().slice(0, 10)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Delete history item
  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("確定要刪除這筆廣播歷史紀錄嗎？");
    if (!confirmed) return;

    const updated = history.filter((h) => h.id !== id);
    saveHistoryToStorage(updated);

    if (activeHistoryId === id) {
      handleReset();
    }
    setSuccessMessage("紀錄已成功刪除。");
  };

  // Render Tone Badge
  const getStyleIcon = (styleId: string) => {
    const styleObj = AUDIO_STYLES.find((s) => s.id === styleId);
    if (!styleObj) return <Volume2 className="w-4 h-4" />;
    switch (styleObj.icon) {
      case "Heart": return <Heart className="w-4 h-4 text-rose-500" />;
      case "Mic": return <Mic className="w-4 h-4 text-blue-500" />;
      case "Sparkles": return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "BookOpen": return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case "AlertTriangle": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Volume2 className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-16">
      {/* Hidden audio tags for processing audio playback */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />
      <audio ref={previewAudioRef} />

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-xs">
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                AI 每週廣播逐字稿助理
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium border border-indigo-100">
                  Gemini AI 語音引擎
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                貼上您的草稿，AI 自動優化語氣腔調，一鍵產生高品質 MP3 / WAV 播報音訊
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleReset}
              className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              title="重設目前工作區"
              id="btn-reset-workspace"
            >
              <RotateCcw className="w-4 h-4" />
              清空開新稿
            </button>
            <a
              href="#templates-section"
              className="px-3.5 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              查看範本
            </a>
          </div>
        </div>
      </header>

      {/* Primary Container */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* Error and Success Toast Notification inside core layout */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-900 rounded-r-xl shadow-sm animate-fade-in flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">操作提示：</span>
              {errorMessage}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 rounded-r-xl shadow-sm animate-fade-in flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold">成功：</span>
              {successMessage}
            </div>
          </div>
        )}

        {/* Templates Banner Row */}
        <section id="templates-section" className="mb-6 bg-white p-4 rounded-xl border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500" /> 快速套用每週常用廣播範本
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SCRIPT_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(tpl)}
                className="text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group flex flex-col justify-between"
                id={`template-btn-${idx}`}
              >
                <div className="font-semibold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">
                  {tpl.title}
                </div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {tpl.content}
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-xs">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    {tpl.voice === "Kore" ? "👩 Kore" : tpl.voice === "Puck" ? "👦 Puck" : "👩 Charon"}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 flex items-center gap-1">
                    {getStyleIcon(tpl.style)}
                    {AUDIO_STYLES.find((s) => s.id === tpl.style)?.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Master Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Draft input and AI Refiner Settings (7 Columns) */}
          <div className="lg:col-span-7 space-y-6 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-md">
                    步驟一
                  </span>
                  <h3 className="text-base font-bold text-slate-900">撰寫或貼上廣播逐字稿草稿</h3>
                </div>
                <span className="text-xs text-slate-400">
                  字數：{rawContent.length} 字
                </span>
              </div>

              {/* Title input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">廣播主題 / 檔名標題</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：本週社區水塔清洗通知"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium transition-all"
                  id="input-broadcast-title"
                />
              </div>

              {/* Core script text area */}
              <div className="relative flex-1 min-h-[300px] flex flex-col">
                <textarea
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="請在此輸入您本週想要廣播的內容逐字稿（支援多行段落，例如：各位住戶好，這禮拜我們要清洗水塔...）"
                  className="w-full flex-1 p-4 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm leading-relaxed resize-none"
                  id="textarea-raw-content"
                />
              </div>

              {/* Optimization control widget */}
              <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    AI 廣播語法口語化優化設定
                  </h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    AI 將修剪贅字，轉化為電台播報腔
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tone Choice */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">潤飾配音基調</label>
                    <select
                      value={refineTone}
                      onChange={(e) => setRefineTone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="select-refine-tone"
                    >
                      {AUDIO_STYLES.map((style) => (
                        <option key={style.id} value={style.id}>
                          {style.name} ({style.description.slice(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Length Choice */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">精簡 / 擴寫程度</label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 border border-slate-200 rounded-md">
                      <button
                        type="button"
                        onClick={() => setRefineLength("shorter")}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${refineLength === "shorter" ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}
                      >
                        精簡
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefineLength("keep")}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${refineLength === "keep" ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}
                      >
                        適中
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefineLength("longer")}
                        className={`py-1 text-[11px] font-medium rounded transition-colors ${refineLength === "longer" ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}
                      >
                        豐富
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePolishScript}
                  disabled={isPolishing || !rawContent.trim()}
                  className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${isPolishing ? "bg-indigo-100 text-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"}`}
                  id="btn-polish-script"
                >
                  {isPolishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      正在由 AI 精心優化廣播逐字稿中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      套用 AI 智慧口語潤飾 (推薦)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Polished Script & Voice settings & Production Panel (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Step 2 Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-md">
                    步驟二
                  </span>
                  <h3 className="text-base font-bold text-slate-900">確認並微調廣播內容</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyText}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
                    title="複製文字"
                    id="btn-copy-polished"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold text-slate-500">
                    AI 潤飾後的最終播報文本（可直接編輯修改）：
                  </label>
                  <button
                    type="button"
                    onClick={handleBakeRepeatText}
                    disabled={!polishedContent && !rawContent}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-100 transition-all cursor-pointer"
                    title={`在稿件中直接複製產生重複段落，並在中間加入停頓 ${repeatDelay} 秒`}
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-500" />
                    產生雙重文本 (停頓 {repeatDelay}s)
                  </button>
                </div>
                <textarea
                  value={polishedContent}
                  onChange={(e) => setPolishedContent(e.target.value)}
                  placeholder="AI 潤飾後的內容會呈現在這裡。您也可以直接在此手動加減文字調整停頓。"
                  className="w-full h-40 p-3 bg-indigo-50/20 border border-indigo-100 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm leading-relaxed resize-none font-medium"
                  id="textarea-polished-content"
                />
              </div>

              {/* Speaker Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500">
                  選擇廣播配音員 (點擊聲音圖示可搶先聆聽音質)：
                </label>
                
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {VOICE_PROFILES.map((voice) => {
                    const isSelected = selectedVoice === voice.id;
                    const isPlaying = isPlayingPreview === voice.id;
                    return (
                      <div
                        key={voice.id}
                        onClick={() => setSelectedVoice(voice.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isSelected ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                        id={`voice-option-${voice.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayVoicePreview(voice);
                            }}
                            className={`p-2 rounded-full transition-colors flex items-center justify-center shrink-0 ${isPlaying ? "bg-indigo-600 text-white animate-bounce" : "bg-slate-100 hover:bg-indigo-100 text-indigo-600"}`}
                            title="預聽此配音員聲音"
                          >
                            {isPlaying ? (
                              <Volume2 className="w-4 h-4" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {voice.name}
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${voice.gender === "female" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-blue-50 text-blue-600 border border-blue-100"}`}>
                                {voice.gender === "female" ? "女聲" : "男聲"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal mt-0.5 max-w-[240px]">
                              {voice.description}
                            </p>
                          </div>
                        </div>

                        {/* Selected Radio Indicator */}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Broadcast style / atmosphere cue */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">選擇朗讀配音風格氣氛：</label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIO_STYLES.map((style) => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`p-2 text-left rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${selectedStyle === style.id ? "border-indigo-600 bg-indigo-50/70 text-indigo-950" : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"}`}
                    >
                      {getStyleIcon(style.id)}
                      <span>{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Audio Button */}
              <button
                type="button"
                onClick={handleGenerateAudio}
                disabled={isGeneratingAudio || (!rawContent.trim() && !polishedContent.trim())}
                className={`w-full py-3 px-5 rounded-xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all ${isGeneratingAudio ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-98"}`}
                id="btn-generate-broadcast-audio"
              >
                {isGeneratingAudio ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正將文字轉為高品質 MP3 音檔...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    產生本週廣播錄音檔 (WAV格式)
                  </>
                )}
              </button>
            </div>

            {/* Custom Interactive Audio Player Panel */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  🎧 高品質廣播播放器
                </h4>
                {generatedAudioUrl && (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
                    24kHz WAV (PCM)
                  </span>
                )}
              </div>

              {generatedAudioUrl ? (
                <div className="space-y-4">
                  {/* Visualizer and file title info */}
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2.5 rounded-lg shrink-0">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate text-white">
                        {title || "每週例行廣播"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>配音：{VOICE_PROFILES.find(v => v.id === selectedVoice)?.name || selectedVoice}</span>
                        <span>•</span>
                        <span>風格：{AUDIO_STYLES.find(s => s.id === selectedStyle)?.name || selectedStyle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Waveform graphic visualization (pure styling simulation with actual play reaction) */}
                  <div className="h-10 flex items-end gap-1 px-2 py-1 bg-slate-950/60 rounded-lg overflow-hidden justify-between">
                    {[6, 12, 24, 18, 32, 14, 8, 16, 28, 38, 20, 10, 14, 26, 34, 12, 18, 8, 22, 36, 16, 12, 28, 4, 18, 32, 24, 12, 8].map((val, index) => {
                      const isActive = isPlaying;
                      const animationDuration = 0.5 + (index % 5) * 0.1;
                      const barHeight = isPlaying ? `${val}px` : "6px";
                      return (
                        <div
                          key={index}
                          className={`w-1.5 rounded-t bg-indigo-500 transition-all duration-300 ${isActive ? "animate-pulse" : "opacity-30"}`}
                          style={{
                            height: barHeight,
                            animationDuration: `${animationDuration}s`,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Dynamic Replay Delay Status Countdown banner */}
                  {isWaitingForNextPlay && (
                    <div className="bg-indigo-950/95 border border-indigo-500/50 rounded-xl p-3 flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        <span className="text-xs font-semibold text-indigo-200">
                          第 {currentPlayIndex} 次播畢。準備進行複誦中...
                        </span>
                      </div>
                      <span className="text-xs bg-indigo-500 text-white font-bold px-2.5 py-0.5 rounded-full font-mono">
                        {countdown} 秒後播第二次
                      </span>
                    </div>
                  )}

                  {/* Play repetition counter indicator */}
                  {isRepeatEnabled && isPlaying && !isWaitingForNextPlay && (
                    <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>📢 正在播報第 {currentPlayIndex} 次...</span>
                      <span>
                        目標複誦：{repeatTimes === -1 ? "持續無限播報" : `${repeatTimes} 次`}
                      </span>
                    </div>
                  )}

                  {/* Interactive Repeating Controls Section */}
                  <div className="bg-slate-950/40 p-3 rounded-xl space-y-2.5 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="enable-auto-repeat"
                          checked={isRepeatEnabled}
                          onChange={(e) => {
                            setIsRepeatEnabled(e.target.checked);
                            if (!e.target.checked) resetPlayerState();
                          }}
                          className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="enable-auto-repeat" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
                          開啟自動「重播複誦」播音
                        </label>
                      </div>
                      <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-900/50">
                        每週重複廣播神器
                      </span>
                    </div>

                    {isRepeatEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                        {/* Repeat Count */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                            播報次數設定：
                          </label>
                          <select
                            value={repeatTimes}
                            onChange={(e) => {
                              setRepeatTimes(parseInt(e.target.value));
                              resetPlayerState();
                            }}
                            className="w-full text-[11px] bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
                          >
                            <option value={2}>廣播 2 次 (播報 → 停頓 → 複誦)</option>
                            <option value={3}>廣播 3 次 (重複 3 次)</option>
                            <option value={4}>廣播 4 次 (重複 4 次)</option>
                            <option value={-1}>無限循環播放 (商店或社區輪播)</option>
                          </select>
                        </div>

                        {/* Repeat Delay Seconds Slider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] font-semibold text-slate-500">
                              每次播完停頓間隔：
                            </label>
                            <span className="text-[10px] font-bold text-indigo-400 font-mono">
                              {repeatDelay} 秒
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={1}
                              max={30}
                              step={1}
                              value={repeatDelay}
                              onChange={(e) => {
                                setRepeatDelay(parseInt(e.target.value));
                                resetPlayerState();
                              }}
                              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom progress sliders & duration markers */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleProgressBarChange}
                      className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Player Buttons Control */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Play Action button */}
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="bg-white text-slate-950 hover:bg-slate-200 p-2.5 rounded-full transition-all active:scale-95 flex items-center justify-center shrink-0"
                        title={isPlaying ? "暫停" : "播放"}
                      >
                        {isPlaying ? <Pause className="w-5 h-5 fill-slate-950 text-slate-950" /> : <Play className="w-5 h-5 fill-slate-950 text-slate-950 ml-0.5" />}
                      </button>

                      {/* Download Action button */}
                      <button
                        type="button"
                        onClick={downloadWavFile}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                        title="下載 WAV 音檔"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        下載 MP3 / WAV
                      </button>
                    </div>

                    {/* Volume Slider Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          setIsMuted(false);
                        }}
                        className="w-16 accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer appearance-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 px-4 text-center border border-dashed border-slate-800 rounded-xl">
                  <Volume2 className="w-8 h-8 text-slate-700 mx-auto mb-2.5" />
                  <p className="text-xs text-slate-400 font-medium">尚未生成音訊檔</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[250px] mx-auto leading-normal">
                    請於上方設定好配音角色，點擊「產生本週廣播錄音檔」按鈕，AI 將即刻開始朗讀。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History / Library section */}
        <section className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              歷史每週廣播紀錄
            </h3>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              共計 {history.length} 篇廣播
            </span>
          </div>

          {history.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => {
                const isActive = activeHistoryId === item.id;
                const voiceName = VOICE_PROFILES.find((v) => v.id === item.voice)?.name || item.voice;
                const styleName = AUDIO_STYLES.find((s) => s.id === item.style)?.name || item.style;

                return (
                  <div
                    key={item.id}
                    onClick={() => loadScript(item)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-3 ${isActive ? "border-indigo-600 bg-indigo-50/20 shadow-xs" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                          {item.title}
                        </h4>
                        <button
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                          title="刪除紀錄"
                          id={`btn-delete-history-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-3 mt-1.5 leading-relaxed">
                        {item.polishedContent || item.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          👩 {voiceName.split(" ")[0]}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">
                          {styleName}
                        </span>
                      </div>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">尚未有任何廣播紀錄</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                每次您點擊「產生本週廣播錄音檔」成功產生配音後，系統將會為您妥善保存內容在此，方便您每週快速複用、下載。
              </p>
            </div>
          )}
        </section>

        {/* User Manual Guidelines FAQ */}
        <section className="mt-8 p-6 bg-indigo-900 text-indigo-100 rounded-2xl shadow-md grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              💡 💡 如何在廣播中加入自然的「停頓與表情語意」？
            </h3>
            <p className="text-xs text-indigo-200 leading-relaxed">
              AI 配音員非常聰明，她會根據您逐字稿中的<b>標點符號</b>與<b>中英文脈絡</b>調整呼吸。為了讓每週的廣播更像真人在講話，您可以嘗試在確認文稿時加入以下小技巧：
            </p>
            <ul className="text-xs text-indigo-100 space-y-1.5 list-disc pl-5">
              <li><b>延長停頓：</b>若要讓語句中間停頓更久，可以改用「……」或多個「，」或使用「 (稍微停頓) 」等括號動作提示。</li>
              <li><b>標點語氣：</b>驚嘆號「！」會微幅提高句尾的朝氣、活力；問號「？」會帶有往上揚的詢問語調。</li>
              <li><b>重要事項加強：</b>可以搭配選擇「警示通知」或「活力宣傳」等特定音訊風格，以獲得完全不同的發音咬字。</li>
            </ul>
          </div>
          <div className="md:col-span-4 bg-indigo-950/60 p-4 rounded-xl border border-indigo-700/50 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">🔒 每週安全與本機保存</h4>
            <p className="text-[11px] text-indigo-300 leading-normal">
              您的逐字稿皆保存在本機 `localStorage`，重新整理瀏覽器也不會消失。生成的語音皆使用雲端即時運算產生，您可以隨時點選「下載 MP3 / WAV」將高品質廣播廣域音檔打包下載帶走！
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

// Time formatter helper (e.g. 75 -> 01:15)
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
