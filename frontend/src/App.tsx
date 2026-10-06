import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, User, Ticket, History, LogOut, CheckCircle, Smartphone, MapPin,
  Calendar, Clock, Film, Hotel, Bus, Shield, Mail, ArrowRight, Eye, EyeOff, Key,
  Sparkles, LogIn, UserPlus, Menu, X, Edit2, Check, Lock, RefreshCw, AlertCircle, AlertTriangle, Trash2,
  Mic, MicOff, Upload, Image, Camera, Sun, Moon
} from "lucide-react";
import InteractiveBookingControls from "./components/InteractiveBookingControls";
import RazorpayModal from "./components/RazorpayModal";
import TicketCard, { generateTicketPDF, isExpiringSoon } from "./components/TicketPDF";
import StarRatingWidget from "./components/StarRatingWidget";
import LocationBar from "./components/LocationBar";
import ResultCards from "./components/ResultCards";
import { useLocation } from "./hooks/useLocation";
import { UserProfile, Booking, Transaction, ChatMessage, BookingType } from "./types";

export default function App() {
  // Navigation & Authentication states
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const { location: userLocation, status: locStatus, request: requestLocation, setManual: setManualLocation } = useLocation(!!user);
  const [authMode, setAuthMode] = useState<"landing" | "login" | "signup" | "forgot" | "reset">("landing");

  // Form inputs
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [authAge, setAuthAge] = useState("");
  const [authDob, setAuthDob] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editAge, setEditAge] = useState(0);
  const [editDob, setEditDob] = useState("");
  const [editPhoto, setEditPhoto] = useState("");

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<{ type: any; data: any } | null>(null);

  // Voice-to-text / Speech Recognition states
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Lists loaded from backend
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTab, setSelectedTab] = useState<"chat" | "bookings" | "transactions" | "profile">("chat");

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("bookease-theme") === "dark";
  });

  // Sync theme with localStorage & document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("bookease-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("bookease-theme", "light");
    }
  }, [isDarkMode]);

  // Payment integration states
  const [razorpayOpen, setRazorpayOpen] = useState(false);
  const [razorpayInfo, setRazorpayInfo] = useState<{ title: string; price: number; type: string; details: any } | null>(null);

  // Mobile drawer state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Sync sidebar open state with screen dimensions on mount and resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync scroll to end of chat messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Load User Data upon state refresh
  const loadUserData = async (uId: string) => {
    try {
      const bRes = await fetch(`/api/bookings/${uId}`);
      const bData = await bRes.json();
      if (bData.bookings) setBookings(bData.bookings);

      const tRes = await fetch(`/api/transactions/${uId}`);
      const tData = await tRes.json();
      if (tData.transactions) setTransactions(tData.transactions);
    } catch (e) {
      console.error("Error loading user data records:", e);
    }
  };

  // Run initial loading
  useEffect(() => {
    if (user && userId) {
      loadUserData(userId);
    }
  }, [user, userId]);

  // Reset chatbot conversation when user logs in
  const initChatbot = () => {
    const defaultMsg: ChatMessage = {
      id: "bot_init",
      sender: "bot",
      text: `<p>Hi <strong>${user?.name || "there"}</strong>! 👋 Welcome to <strong>Praveen AI</strong>. I am your AI booking copilot, powered by Google Gemini. I use your live location to find things near you.</p>
             <p>What would you like to arrange today? Select an option or tell me in your own words:</p>
             <ul class="space-y-1 mt-2 list-disc list-inside">
               <li>🎥 <strong>Trending movies</strong> at theatres near you</li>
               <li>🏨 <strong>Hotels &amp; hostels</strong> near your location</li>
               <li>🚌 <strong>Bus tickets</strong> between real cities (AbhiBus-style)</li>
             </ul>`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages([defaultMsg]);
    setActiveAction(null);
  };

  useEffect(() => {
    if (user) {
      initChatbot();
      // Initialize edit fields
      setEditName(user.name);
      setEditNumber(user.number);
      setEditAge(user.age);
      setEditDob(user.dob);
      setEditPhoto(user.photoUrl);
    }
  }, [user]);

  // Forms Actions
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
          number: authNumber,
          age: authAge,
          dob: authDob
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }
      setAuthSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        setAuthMode("login");
        setAuthSuccess("");
        setAuthPassword("");
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Invalid credentials");
      }
      setUserId(data.userId);
      setUser(data.profile);
      setAuthMode("landing"); // Authenticated
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mock Google Sign-In Simulation
  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "joyboyluffy7203111@gmail.com",
          name: "Luffy Joyboy",
          photoUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"
        })
      });
      const data = await response.json();
      if (response.ok) {
        setUserId(data.userId);
        setUser(data.profile);
        setAuthMode("landing");
      }
    } catch (e: any) {
      setAuthError("Failed mock Google login.");
    }
  };

  // Forgot password flow
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Reset request failed");
      }
      setAuthSuccess(data.message);
      setAuthMode("reset");
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset password verification
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          otp: authOtp,
          newPassword: authPassword
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "OTP verification failed");
      }
      setAuthSuccess("Password has been reset successfully! Login now.");
      setTimeout(() => {
        setAuthMode("login");
        setAuthSuccess("");
        setAuthPassword("");
        setAuthOtp("");
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle local image file upload and conversion to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setEditPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save profile edits
  const handleSaveProfile = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/profile/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          number: editNumber,
          age: editAge,
          dob: editDob,
          photoUrl: editPhoto
        })
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.profile);
        setIsEditingProfile(false);
      }
    } catch (e) {
      console.error("Error updating profile:", e);
    }
  };

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Toggle Speech Recognition for Voice-to-Text
  const toggleListening = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setSpeechError("Voice input is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error("Error stopping recognition:", e);
        }
      }
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        const rec = new SpeechRecognitionAPI();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setUserInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            setSpeechError("Microphone permission denied. Please allow mic access in your browser.");
          } else if (event.error === "no-speech") {
            setSpeechError("No speech detected. Please speak clearly.");
          } else {
            setSpeechError(`Voice error: ${event.error}`);
          }
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (err: any) {
        console.error("Failed to start recognition instance:", err);
        setSpeechError("Failed to access your microphone.");
        setIsListening(false);
      }
    }
  };

  // Send conversational prompt to server-side Gemini chatbot
  const handleSendChatMessage = async (textToSend?: string) => {
    const rawInput = textToSend || userInput;
    if (!rawInput.trim() || chatLoading) return;

    if (!textToSend) {
      setUserInput("");
    }

    const newUserMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substr(2, 9),
      sender: "user",
      text: rawInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setChatLoading(true);
    setActiveAction(null); // Clear active interactive block

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          userProfile: user,
          location: userLocation
        })
      });
      const data = await response.json();

      const newBotMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        sender: "bot",
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, newBotMsg]);

      // Check if Gemini triggered an action block
      if (data.action && data.action.type) {
        setActiveAction({
          type: data.action.type,
          data: data.action.data
        });
      }
    } catch (e) {
      console.error("Chatbot processing error:", e);
      setChatMessages((prev) => [
        ...prev,
        {
          id: "err_" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: "I had a tiny connectivity hiccup with my ML core. Could you please send your message again?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Interactive UI widget completed selection
  const handleInteractiveConfirm = (summaryText: string, compiledData: any) => {
    // Add user message to chat listing the selections
    const userSummaryMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substr(2, 9),
      sender: "user",
      text: summaryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userSummaryMsg]);
    setActiveAction(null); // Clear selected action widget

    // Let Gemini summarize the ticket and trigger the RazorPay modal
    setChatLoading(true);
    setTimeout(async () => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...chatMessages, userSummaryMsg],
            userProfile: user,
          location: userLocation
          })
        });
        const data = await response.json();

        const botSummaryMsg: ChatMessage = {
          id: "msg_" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatMessages((prev) => [...prev, botSummaryMsg]);

        // If Gemini triggers payment, load razorpayInfo state
        if (data.action && data.action.type === "trigger_payment") {
          setRazorpayInfo({
            title: compiledData.title,
            price: compiledData.price,
            type: compiledData.type,
            details: compiledData.details
          });
          setRazorpayOpen(true);
        } else {
          // Fallback if model didn't trigger, trigger it manually
          setRazorpayInfo({
            title: compiledData.title,
            price: compiledData.price,
            type: compiledData.type,
            details: compiledData.details
          });
          setRazorpayOpen(true);
        }
      } catch (e) {
        console.error("Gemini failed after selection confirmation:", e);
      } finally {
        setChatLoading(false);
      }
    }, 1000);
  };

  // RazorPay Payment Approved Callback
  const handlePaymentSuccess = async (paymentMethod: string) => {
    if (!razorpayInfo || !userId) return;

    setRazorpayOpen(false);
    setChatLoading(true);

    try {
      // Create real persistent booking and transaction records on the server
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: razorpayInfo.type,
          title: razorpayInfo.title,
          price: razorpayInfo.price,
          details: razorpayInfo.details,
          paymentMethod
        })
      });
      const data = await response.json();

      if (data.success) {
        // Sync lists
        await loadUserData(userId);

        // Add user statement confirming success
        const clientPaidMsg: ChatMessage = {
          id: "msg_" + Math.random().toString(36).substr(2, 9),
          sender: "user",
          text: `Payment of ₹${razorpayInfo.price} successful via ${paymentMethod}! Secure Transaction ID: TXN_RP_${data.transaction.id.toUpperCase().slice(-5)}. Please issue my tickets.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Get Gemini congratulations and Ticket attachment!
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...chatMessages, clientPaidMsg],
            userProfile: user,
          location: userLocation
          })
        });
        const chatData = await chatRes.json();

        // Push messages to chat
        const botSuccessMsg: ChatMessage = {
          id: "msg_" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: chatData.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const ticketActionMsg: ChatMessage = {
          id: "msg_ticket_" + Math.random().toString(36).substr(2, 9),
          sender: "bot",
          text: `🎉 <strong>E-Ticket Generated!</strong> Click the button below to download your printable PDF, or check your simulated Email Inbox.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          interactiveAction: {
            type: "ticket_issued",
            data: data.booking
          }
        };

        setChatMessages((prev) => [...prev, clientPaidMsg, botSuccessMsg, ticketActionMsg]);
      }
    } catch (e) {
      console.error("Failed final ticket compilation after payment:", e);
    } finally {
      setChatLoading(false);
      setRazorpayInfo(null);
    }
  };

  const logout = () => {
    setUser(null);
    setUserId("");
    setAuthMode("landing");
    setBookings([]);
    setTransactions([]);
    setSelectedTab("chat");
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col selection:bg-orange-100 selection:text-orange-900 transition-colors duration-250 ${isDarkMode ? 'dark bg-zinc-950 text-zinc-50' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-orange-50/80 sticky top-0 z-40 px-4 py-3.5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          {user && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              aria-label="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-white text-base">BA</div>
            <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">BookAura</span>
          </div>
        </div>

        {/* Action icons and User display */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Logged in User Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-xs">
                <img src={user.photoUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
                <span className="font-semibold text-slate-700">{user.name}</span>
              </div>

              <button
                onClick={logout}
                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setAuthMode("login"); setAuthError(""); }}
                className="px-4 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Mobile Sidebar Backdrop Overlay */}
        {user && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR FOR AUTHENTICATED USERS */}
        {user && (
          <aside className={`bg-[#0f172a] text-slate-300 flex flex-col shrink-0 transition-all duration-300 z-30 absolute lg:relative inset-y-0 left-0 pt-16 lg:pt-0 ${
            sidebarOpen 
              ? "w-64 translate-x-0 border-r border-slate-800" 
              : "w-64 -translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0 overflow-hidden"
          }`}>
            
            {/* User Profile Summary */}
            <div className="p-5 border-b border-slate-800 text-center">
              <div className="relative inline-block">
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-orange-500 shadow-md"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-orange-500 rounded-full border-2 border-[#0f172a]" />
              </div>
              <h4 className="font-bold text-sm text-white mt-2 leading-snug">{user.name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{user.email}</p>
            </div>

            {/* Sidebar Navigation Options */}
            <nav className="flex-1 p-3 space-y-1">
              <button
                onClick={() => { setSelectedTab("chat"); setSidebarOpen(false); }}
                className={`w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer ${
                  selectedTab === "chat" ? "bg-orange-600 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare size={16} />
                <span>BookAura Chatbot</span>
              </button>

              <button
                onClick={() => { setSelectedTab("profile"); setSidebarOpen(false); }}
                className={`w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer ${
                  selectedTab === "profile" ? "bg-orange-600 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <User size={16} />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => { setSelectedTab("bookings"); setSidebarOpen(false); }}
                className={`w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer relative ${
                  selectedTab === "bookings" ? "bg-orange-600 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Ticket size={16} />
                <span>My Bookings</span>
                {bookings.some(isExpiringSoon) && (
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full border border-slate-950 absolute left-6 top-3.5 animate-ping"></span>
                )}
                {bookings.length > 0 && (
                  <span className="ml-auto bg-slate-800 text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1.5">
                    <span>{bookings.length}</span>
                    {bookings.some(isExpiringSoon) && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse" title="Expiring soon tickets detected"></span>
                    )}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setSelectedTab("transactions"); setSidebarOpen(false); }}
                className={`w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer ${
                  selectedTab === "transactions" ? "bg-orange-600 text-white" : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <History size={16} />
                <span>Transactions</span>
              </button>

              <div className="border-t border-slate-800/80 my-3 pt-3 px-1">
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2 px-3">
                  Accessibility
                </div>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="w-full px-4 py-2 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {isDarkMode ? <Moon size={14} className="text-amber-400" /> : <Sun size={14} className="text-amber-500" />}
                    <span>{isDarkMode ? "High-Contrast Dark" : "Default Light"}</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${isDarkMode ? 'bg-orange-600' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </nav>

            {/* Sidebar Footer details */}
            <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center leading-normal">
              BookAura Booking Platform • Sandbox Mode Active
            </div>
          </aside>
        )}

        {/* PRIMARY VIEW CONTENT */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50">
          
          {/* LANDING PAGE (UNAUTHENTICATED) */}
          {!user && authMode === "landing" && (
            <div className="flex-1 overflow-y-auto px-5 py-12 flex flex-col justify-center max-w-4xl mx-auto space-y-12">
              
              {/* Brand introduction */}
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-100">
                  <Sparkles size={12} /> Next-Gen Booking Agent
                </span>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                  Book Movie, Hotel, and Bus Tickets via <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Conversational Chat</span>
                </h1>
                <p className="text-slate-500 text-sm md:text-base leading-relaxed">
                  BookAura leverages server-side Machine Learning model to comprehend and process booking slots directly in context. Just state your plans and let the AI compile, book, and deliver printable PDF tickets to your email.
                </p>
                <div className="pt-3 flex gap-4 justify-center">
                  <button
                    onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-100 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Create Free Account</span>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm border border-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    Log In
                  </button>
                </div>
              </div>

              {/* How it works layout */}
              <div className="space-y-6">
                <h3 className="text-center text-lg font-bold text-slate-800 tracking-wide">How It Works</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm mx-auto mb-3">1</div>
                    <h4 className="font-bold text-slate-800 text-sm">Interactive Login</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">Register manually or log in with mock Google services securely.</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm mx-auto mb-3">2</div>
                    <h4 className="font-bold text-slate-800 text-sm">Conversational Chat</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">Describe your plans: movie time, hotel dates, or traveling routes.</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm mx-auto mb-3">3</div>
                    <h4 className="font-bold text-slate-800 text-sm">Interactive Grids</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">Select your movie seats, bus berths, or room choices instantly inside the chat.</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm text-center">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm mx-auto mb-3">4</div>
                    <h4 className="font-bold text-slate-800 text-sm">Download PDF</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">Simulate Razorpay checkout, receive the ticket PDF, and get notified on email!</p>
                  </div>
                </div>
              </div>

              {/* Partners section */}
              <div className="pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4">Partner Theatres, Hotels, and Bus Operators</p>
                <div className="flex flex-wrap justify-center gap-6 text-slate-400 font-bold text-xs">
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🍿 PVR Cinemas</span>
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🍿 INOX Movies</span>
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🏨 Taj Residency</span>
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🏨 Marriott Suites</span>
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🚍 VRL Travels</span>
                  <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">🚍 KSRTC Swift</span>
                </div>
              </div>

            </div>
          )}

          {/* LOGIN CARD */}
          {authMode === "login" && (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-5 animate-fade-in text-slate-700">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-slate-900">Welcome Back</h3>
                  <p className="text-xs text-slate-400 mt-1">Log in to consult the BookAura chatbot assistant.</p>
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="joyboyluffy7203111@gmail.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-500">Password</label>
                      <button
                        type="button"
                        onClick={() => setAuthMode("forgot")}
                        className="text-[10px] text-orange-600 hover:underline font-bold cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <LogIn size={14} />}
                    <span>Submit credentials</span>
                  </button>
                </form>

                {/* Google login shortcut */}
                <div className="space-y-3">
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold uppercase">OR SIMULATE</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    {/* Google Styled Icon */}
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.61 0 3.05.55 4.19 1.63l3.12-3.12C17.43 1.84 14.9 1 12 1 7.35 1 3.39 3.67 1.49 7.55l3.69 2.87C6.09 7.37 8.82 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.43c-.28 1.46-1.1 2.69-2.33 3.51l3.63 2.81c2.13-1.97 3.39-4.87 3.39-8.42z" />
                      <path fill="#FBBC05" d="M5.18 10.42c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.49 2.97C.54 4.9.01 7.07.01 9.38c0 2.3.53 4.47 1.48 6.4l3.69-2.87c-.24-.72-.38-1.49-.38-2.29z" />
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.81c-1.01.68-2.3 1.08-4.33 1.08-3.18 0-5.91-2.33-6.82-5.38L1.49 15.8C3.39 19.68 7.35 23 12 23z" />
                    </svg>
                    <span>Sign In with Google</span>
                  </button>
                </div>

                <div className="text-center text-xs text-slate-400 pt-1">
                  Don't have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                    className="text-orange-600 hover:underline font-bold cursor-pointer"
                  >
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIGNUP CARD */}
          {authMode === "signup" && (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in text-slate-700">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-slate-900">Create Account</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold text-orange-600">Get started in under a minute</p>
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
                {authSuccess && (
                  <div className="bg-orange-50 border border-orange-100 p-2.5 rounded-lg flex items-center gap-2 text-orange-700 text-xs font-semibold">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Luffy Joyboy"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="joyboyluffy7203111@gmail.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Mobile Number</label>
                      <input
                        type="text"
                        placeholder="+91 9876543210"
                        value={authNumber}
                        onChange={(e) => setAuthNumber(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Age</label>
                      <input
                        type="number"
                        placeholder="19"
                        value={authAge}
                        onChange={(e) => setAuthAge(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-0.5">Date of Birth (DOB)</label>
                      <input
                        type="date"
                        value={authDob}
                        onChange={(e) => setAuthDob(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <UserPlus size={14} />}
                    <span>Submit registration</span>
                  </button>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold uppercase">OR</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.61 0 3.05.55 4.19 1.63l3.12-3.12C17.43 1.84 14.9 1 12 1 7.35 1 3.39 3.67 1.49 7.55l3.69 2.87C6.09 7.37 8.82 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.43c-.28 1.46-1.1 2.69-2.33 3.51l3.63 2.81c2.13-1.97 3.39-4.87 3.39-8.42z" />
                    <path fill="#FBBC05" d="M5.18 10.42c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.49 2.97C.54 4.9.01 7.07.01 9.38c0 2.3.53 4.47 1.48 6.4l3.69-2.87c-.24-.72-.38-1.49-.38-2.29z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.63-2.81c-1.01.68-2.3 1.08-4.33 1.08-3.18 0-5.91-2.33-6.82-5.38L1.49 15.8C3.39 19.68 7.35 23 12 23z" />
                  </svg>
                  <span>Quick Sign Up via Google</span>
                </button>

                <div className="text-center text-xs text-slate-400 pt-1">
                  Already have an account?{" "}
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); }}
                    className="text-orange-600 hover:underline font-bold cursor-pointer"
                  >
                    Log In
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD SECTION */}
          {authMode === "forgot" && (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in text-slate-700">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-slate-900">Forgot Password</h3>
                  <p className="text-xs text-slate-400 mt-1">We will generate and dispatch a 6-digit One Time Password (OTP) to your email account.</p>
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Registered Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="joyboyluffy7203111@gmail.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <Mail size={14} />}
                    <span>Dispatch OTP Code</span>
                  </button>
                </form>

                <div className="text-center text-xs pt-1">
                  <button
                    onClick={() => setAuthMode("login")}
                    className="text-slate-400 hover:text-slate-600 font-bold hover:underline cursor-pointer"
                  >
                    Return to Login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RESET PASSWORD WITH OTP SECTION */}
          {authMode === "reset" && (
            <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-white border border-slate-100 rounded-2xl p-6 shadow-xl space-y-4 animate-fade-in text-slate-700">
                <div className="text-center">
                  <h3 className="font-extrabold text-xl text-slate-900 flex justify-center items-center gap-1.5">
                    <Key className="text-amber-500" size={20} />
                    <span>Verify Code</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Check the <strong>Mock Email Client</strong> panel at the top right to copy the received OTP.</p>
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg flex items-center gap-2 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}
                {authSuccess && (
                  <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg flex items-center gap-2 text-amber-700 text-xs font-semibold">
                    <Sparkles size={14} className="shrink-0" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">6-Digit OTP Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center text-lg font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Choose New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={14} /> : <Lock size={14} />}
                    <span>Reset Password</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ACTIVE CHAT TAB (AUTHENTICATED) */}
          {user && selectedTab === "chat" && (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
              
              {/* Chat Stream Header */}
              <div className="bg-white border-b border-slate-100 px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-600 rounded-full animate-ping" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">BookAura AI Active</span>
                </div>
                <button
                  onClick={initChatbot}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded border border-slate-200 hover:border-orange-100 transition-colors cursor-pointer"
                >
                  Restart Chat
                </button>
              </div>

              <LocationBar
                location={userLocation}
                status={locStatus}
                onRetry={requestLocation}
                onManual={setManualLocation}
              />

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg) => {
                  const isBot = msg.sender === "bot";
                  return (
                    <div key={msg.id} className={`flex flex-col ${isBot ? "items-start" : "items-end"} animate-fade-in`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                        isBot
                          ? "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                          : "bg-orange-600 text-white rounded-tr-none font-medium"
                      }`}>
                        {/* Render chatbot text */}
                        <div
                          className="text-sm leading-relaxed whitespace-pre-wrap select-text font-sans"
                          dangerouslySetInnerHTML={{ __html: msg.text }}
                        />

                        {/* Render PDF ticket inside chat stream as confirmed pass */}
                        {msg.interactiveAction?.type === "ticket_issued" && (
                          <div className="mt-4 pt-4 border-t border-dashed border-slate-100/50 space-y-4">
                            <TicketCard
                              booking={msg.interactiveAction.data}
                              userName={user.name}
                            />
                            <StarRatingWidget
                              bookingId={msg.interactiveAction.data.id}
                              bookingTitle={msg.interactiveAction.data.title}
                            />
                          </div>
                        )}
                      </div>
                      
                      <span className="text-[9px] text-slate-400 font-bold mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })}

                {/* Interactive Selection Action Widget inside Stream */}
                {activeAction && activeAction.type === "show_results" && (
                  <div className="animate-slide-in relative">
                    <ResultCards data={activeAction.data} onPick={(msg) => handleSendChatMessage(msg)} />
                  </div>
                )}
                {activeAction && activeAction.type !== "show_results" && (
                  <div className="animate-slide-in relative">
                    <InteractiveBookingControls
                      actionType={activeAction.type}
                      actionData={activeAction.data}
                      onConfirm={handleInteractiveConfirm}
                    />
                  </div>
                )}

                {/* Bot Typing Bubble */}
                {chatLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="flex flex-col items-start"
                  >
                    <div className="bg-white border border-slate-100/80 rounded-2xl rounded-tl-none p-3.5 shadow-md shadow-slate-100/50 flex flex-col gap-2 max-w-xs relative overflow-hidden">
                      {/* Smooth top flow gradient glow */}
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 bg-[length:200%_auto] animate-gradient-flow" />

                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center w-7 h-7 bg-orange-50 rounded-xl text-orange-600 shrink-0">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkles size={14} className="text-orange-600" />
                          </motion.div>
                          <span className="absolute inset-0 rounded-xl bg-orange-400/20 animate-ping" />
                        </div>
                        
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                            BookAura AI
                          </span>
                          <span className="text-xs font-bold text-slate-700 tracking-tight">
                            Analyzing request...
                          </span>
                        </div>
                      </div>

                      {/* Smooth flowing fluid loading wave */}
                      <div className="flex items-center gap-1.5 pl-10 py-1">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{
                              y: [-4, 4, -4],
                              scale: [1, 1.25, 1],
                              opacity: [0.4, 1, 0.4]
                            }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.2
                            }}
                            className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-600 shadow-sm"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Quick Chat suggestions */}
              {chatMessages.length <= 1 && (
                <div className="p-3 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto text-[11px] font-bold text-slate-600 shrink-0">
                  <span className="shrink-0 text-slate-400 py-0.5 px-1 uppercase tracking-wider">Try:</span>
                  <button
                    onClick={() => handleSendChatMessage("Show me trending movies near me")}
                    className="shrink-0 px-3 py-1 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 rounded-full border border-slate-200 hover:border-orange-100 transition-all cursor-pointer"
                  >
                    🍿 Trending movies near me
                  </button>
                  <button
                    onClick={() => handleSendChatMessage("Show hotels and hostels near me")}
                    className="shrink-0 px-3 py-1 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 rounded-full border border-slate-200 hover:border-orange-100 transition-all cursor-pointer"
                  >
                    🏨 Stays near me
                  </button>
                  <button
                    onClick={() => handleSendChatMessage("I want to book a bus ticket")}
                    className="shrink-0 px-3 py-1 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 rounded-full border border-slate-200 hover:border-orange-100 transition-all cursor-pointer"
                  >
                    🚍 Book a bus
                  </button>
                </div>
              )}

              {/* Chat Send Input Box */}
              <div className="flex flex-col border-t border-slate-100 bg-white">
                {speechError && (
                  <div className="px-4 py-2 text-xs text-rose-600 bg-rose-50 border-b border-rose-100 flex justify-between items-center animate-fade-in">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-rose-500" />
                      {speechError}
                    </span>
                    <button
                      onClick={() => setSpeechError(null)}
                      className="hover:bg-rose-100 p-0.5 rounded transition-colors text-rose-500 hover:text-rose-700 font-bold text-sm"
                      title="Clear error"
                    >
                      &times;
                    </button>
                  </div>
                )}
                <div className="p-4 flex gap-2 items-center">
                  <input
                    type="text"
                    disabled={chatLoading}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                    placeholder={
                      activeAction
                        ? "Complete the visual selection above to continue..."
                        : isListening
                        ? "Listening... Speak your request now..."
                        : "Ask BookAura: 'Book 2 seats for Dune at PVR'..."
                    }
                    className="flex-grow px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60 text-slate-800"
                  />
                  
                  {/* Voice-to-Text Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={chatLoading}
                    className={`p-2.5 rounded-xl transition-all border ${
                      isListening
                        ? "bg-rose-500 border-rose-500 text-white animate-pulse shadow-md shadow-rose-100"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    } hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
                    title={isListening ? "Stop listening" : "Dictate your booking request"}
                  >
                    <Mic size={18} />
                  </button>

                  <button
                    onClick={() => handleSendChatMessage()}
                    disabled={chatLoading || !userInput.trim()}
                    className={`p-2.5 rounded-xl transition-all font-bold ${
                      !userInput.trim() || chatLoading
                        ? "bg-slate-100 text-slate-300"
                        : "bg-orange-600 text-white shadow-md shadow-orange-100 hover:scale-105 active:scale-95 cursor-pointer"
                    }`}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* MY PROFILE TAB */}
          {user && selectedTab === "profile" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-md space-y-6 animate-fade-in text-slate-700">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">User Profile Record</h3>
                    <p className="text-xs text-slate-400 mt-1">Manage registration details and photo avatars.</p>
                  </div>
                  {!isEditingProfile ? (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-3.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit2 size={12} />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        className="px-3 py-1.5 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Save Profile</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Profile Display / Edit Form */}
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                  
                  {/* Avatar Upload Display */}
                  <div className="flex flex-col items-center gap-4 shrink-0 sm:w-48">
                    <div className="relative group">
                      <img
                        src={isEditingProfile ? editPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80" : user.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80"}
                        alt={user.name}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl"
                      />
                      {isEditingProfile && (
                        <label
                          htmlFor="profile-avatar-file"
                          className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold gap-1"
                        >
                          <Camera size={18} className="text-orange-400" />
                          <span>Change Photo</span>
                        </label>
                      )}
                    </div>

                    {isEditingProfile && (
                      <div className="w-full space-y-3.5 text-center">
                        <input
                          type="file"
                          id="profile-avatar-file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="profile-avatar-file"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer transition-all border border-slate-200"
                        >
                          <Upload size={12} className="text-slate-500" />
                          <span>Upload File</span>
                        </label>

                        {/* Curated Preset Avatars */}
                        <div className="space-y-1.5">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Or Choose Avatar
                          </span>
                          <div className="flex justify-center gap-1.5 flex-wrap">
                            {[
                              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
                              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
                              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
                              "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80",
                              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80"
                            ].map((presetUrl, idx) => {
                              const isSelected = editPhoto === presetUrl;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setEditPhoto(presetUrl)}
                                  className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                                    isSelected ? "border-orange-600 scale-110 shadow-sm" : "border-slate-100 hover:border-slate-300"
                                  }`}
                                >
                                  <img
                                    src={presetUrl}
                                    alt={`Preset ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Text URL Option */}
                        <div className="space-y-1 text-left">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Or Paste Photo Image URL
                          </label>
                          <input
                            type="text"
                            value={editPhoto}
                            onChange={(e) => setEditPhoto(e.target.value)}
                            placeholder="https://example.com/photo.jpg"
                            className="w-full px-2 py-1 text-[10px] border border-slate-200 rounded focus:outline-none focus:border-orange-500 bg-slate-50"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form detail grids */}
                  <div className="flex-grow w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                    
                    <div>
                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Full Name</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 text-sm bg-slate-50 px-3 py-2 rounded-lg">{user.name}</p>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Email Account</span>
                      <p className="font-mono text-slate-500 text-xs sm:text-sm bg-slate-100 px-3 py-2 rounded-lg cursor-not-allowed select-text break-all" title={user.email}>
                        {user.email}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Phone Number</span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 text-sm bg-slate-50 px-3 py-2 rounded-lg">{user.number || "Not specified"}</p>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Age Detail</span>
                      {isEditingProfile ? (
                        <input
                          type="number"
                          value={editAge}
                          onChange={(e) => setEditAge(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 text-sm bg-slate-50 px-3 py-2 rounded-lg">{user.age} Years Old</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider mb-1">Date of Birth (DOB)</span>
                      {isEditingProfile ? (
                        <input
                          type="date"
                          value={editDob}
                          onChange={(e) => setEditDob(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 text-sm bg-slate-50 px-3 py-2 rounded-lg">{user.dob}</p>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            </div>
          )}

          {/* MY BOOKINGS TAB */}
          {user && selectedTab === "bookings" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <div>
                  <h3 className="font-black text-xl text-slate-900 tracking-tight">Active Reservations</h3>
                  <p className="text-xs text-slate-400 mt-1">Select any ticket to redownload its printable PDF pass.</p>
                </div>
                <span className="bg-orange-50 text-orange-700 text-xs font-bold px-3 py-1 rounded-full border border-orange-100">
                  {bookings.length} Confirmed Pass(es)
                </span>
              </div>

              {bookings.length > 0 && bookings.some(isExpiringSoon) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start animate-fade-in text-amber-900 shadow-sm">
                  <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="font-extrabold text-sm text-amber-950">Urgent: Upcoming Reservation Alert</h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      You have active ticket bookings with events scheduled to start within the next 24 hours. Be sure to download your PDF ticket passes and have them ready at checkpoints!
                    </p>
                  </div>
                </div>
              )}

              {bookings.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-4 shadow-sm animate-fade-in">
                  <Ticket size={36} className="text-slate-300 mx-auto" />
                  <div>
                    <h4 className="font-bold text-slate-800">No Bookings Yet</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Trigger a reservation with the BookAura AI assistant to compile tickets instantly!</p>
                  </div>
                  <button
                    onClick={() => setSelectedTab("chat")}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Launch Booking Assistant
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {bookings.map((b) => (
                    <div key={b.id} className="relative group">
                      <TicketCard
                        booking={b}
                        userName={user.name}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TRANSACTIONS TAB */}
          {user && selectedTab === "transactions" && (
            <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-6">
              <div className="pb-2 border-b border-slate-200">
                <h3 className="font-black text-xl text-slate-900 tracking-tight">Billing & Transactions</h3>
                <p className="text-xs text-slate-400 mt-1">Review verified transaction ledger receipts processed securely by RazorPay gateway.</p>
              </div>

              {transactions.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center space-y-3 shadow-sm">
                  <History size={36} className="text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600">No payment records available</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-md overflow-hidden animate-fade-in">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                        <th className="p-4">Transaction ID</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Item/Booking Title</th>
                        <th className="p-4">Payment Method</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-800">TXN_RP_{t.id.toUpperCase().slice(-6)}</td>
                          <td className="p-4 text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 font-bold text-slate-700">{t.title}</td>
                          <td className="p-4 text-slate-500">{t.paymentMethod}</td>
                          <td className="p-4 font-extrabold text-right text-slate-900">₹{t.amount.toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <span className="bg-orange-50 text-orange-700 border border-orange-100 font-bold px-2 py-0.5 rounded text-[10px]">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* RAZORPAY GATEWAY CHECKOUT OVERLAY PANEL */}
      {razorpayOpen && razorpayInfo && (
        <RazorpayModal
          isOpen={razorpayOpen}
          onClose={() => setRazorpayOpen(false)}
          bookingInfo={razorpayInfo}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

    </div>
  );
}
