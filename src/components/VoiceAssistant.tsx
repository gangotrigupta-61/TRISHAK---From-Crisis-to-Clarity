import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, X, Zap, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function VoiceAssistant({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      stopAudioCapture();
    };
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }],
          systemInstruction: `You are the TRISHAK AI Incident Commander. 
            User Info: Role=${profile?.role || 'Rescuer'}, Name=${profile?.displayName || 'TRISHAK Responder'}.
            Provide tactical voice-based guidance for emergency responders. 
            RULES: 
            1. Be extremely concise. 
            2. Prioritize safety and clarity. 
            3. Use your Google Search capabilities to find real-time info (hospitals, weather, routes) only if asked or strictly necessary.
            4. This is a real-time voice session, avoid long explanations.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
          }
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              playAudio(message.serverContent.modelTurn.parts[0].inlineData.data);
            }
            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              const text = message.serverContent.modelTurn.parts[0].text;
              setTranscript(prev => {
                const last = prev[prev.length - 1];
                if (last?.startsWith('AI:')) {
                  return [...prev.slice(0, -1), last + text];
                }
                return [...prev, `AI: ${text}`];
              });
            }
            if (message.serverContent?.interrupted) {
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            stopAudioCapture();
            setIsConnected(false);
            setIsConnecting(false);
            sessionRef.current = null;
            sessionPromiseRef.current = null;
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setIsConnecting(false);
            setIsConnected(false);
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      const session = await sessionPromise;
      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      setIsConnecting(false);
    }
  };

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      processorRef.current.onaudioprocess = async (e) => {
        if (isMuted || !isConnected || !sessionPromiseRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        try {
          const session = await sessionPromiseRef.current;
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        } catch (error) {
          console.error("Failed to send audio input:", error);
        }
      };
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("Audio capture error:", err);
    }
  };

  const stopAudioCapture = () => {
    try {
      sourceRef.current?.disconnect();
      processorRef.current?.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    } catch (e) {
      console.warn("Audio stop warning:", e);
    }
  };

  const nextStartTimeRef = useRef<number>(0);

  const playAudio = async (base64Data: string) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 0x7FFF;
      
      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      // Gapless playback scheduling
      const currentTime = audioContextRef.current.currentTime;
      let startTime = Math.max(currentTime, nextStartTimeRef.current);
      
      // If we've drifted too far, reset
      if (startTime > currentTime + 0.5) {
        startTime = currentTime;
      }
      
      source.start(startTime);
      nextStartTimeRef.current = startTime + buffer.duration;
    } catch (err) {
      console.error("Playback error:", err);
    }
  };

  const closeSession = () => {
    sessionRef.current?.close();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 bg-bg-secondary text-text-primary rounded-3xl shadow-2xl overflow-hidden border border-card-border"
          >
            <div className="p-6 border-b border-card-border flex items-center justify-between bg-bg-primary/30 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-400 p-2 rounded-xl shadow-lg shadow-yellow-500/20">
                  <Zap className="text-black w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Voice Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-text-secondary/30")}></div>
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-50">
                      {isConnecting ? "Connecting..." : isConnected ? "Live" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={closeSession} className="p-2 hover:bg-bg-primary rounded-full transition-all text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-64 overflow-y-auto p-6 space-y-4 bg-bg-primary/50">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Mic className="w-10 h-10 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Speak now for guidance</p>
                </div>
              ) : (
                transcript.map((t, i) => (
                  <p key={i} className="text-xs text-text-secondary leading-relaxed font-medium">{t}</p>
                ))
              )}
            </div>

            <div className="p-6 bg-bg-secondary flex items-center justify-center gap-6 border-t border-card-border">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "p-4 rounded-2xl transition-all shadow-sm border",
                  isMuted ? "bg-accent-emergency/10 text-accent-emergency border-accent-emergency/20" : "bg-bg-primary text-text-secondary border-card-border"
                )}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              {!isConnected && !isConnecting && (
                <button 
                  onClick={startSession}
                  className="bg-accent-emergency hover:bg-red-700 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-red-500/20 transition-all uppercase tracking-widest text-xs"
                >
                  Start Session
                </button>
              )}

              {isConnected && (
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-accent-emergency animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-6 bg-accent-emergency animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-3 bg-accent-emergency animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-5 bg-accent-emergency animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 group relative",
          isOpen ? "bg-text-primary text-bg-primary" : "bg-accent-emergency text-white hover:bg-red-700"
        )}
      >
        {isOpen ? <X className="w-8 h-8" /> : <Zap className="w-8 h-8 group-hover:text-yellow-400 transition-colors" />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-bg-primary animate-bounce shadow-sm"></div>
        )}
      </button>
    </div>
  );
}
