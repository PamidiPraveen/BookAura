import React, { useState } from "react";
import { Download, Sparkles, Film, Hotel, Bus, CheckCircle2, AlertTriangle, MapPin, Palette, Check } from "lucide-react";
import { jsPDF } from "jspdf";
import { motion } from "motion/react";
import { Booking, MovieDetails, HotelDetails, BusDetails } from "../types";

// Helper to check if event starts within next 24 hours
export function isExpiringSoon(booking: Booking): boolean {
  try {
    const now = new Date();
    const eventDate = new Date(booking.date);
    
    // Get difference in milliseconds
    const diffMs = eventDate.getTime() - now.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Check if the event is today or tomorrow (or within 24 hours)
    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = new Date(now.getTime() + oneDayMs).toISOString().split("T")[0];
    
    if (booking.date === todayStr || booking.date === tomorrowStr) {
      return true;
    }
    
    return diffMs > -7200000 && diffMs <= oneDayMs; // up to 2 hours past, and 24 hours into future
  } catch (e) {
    return false;
  }
}

// Helper to format date like "Fri, 07 Jul '23"
const formatTicketDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayName = days[d.getDay()];
    const dateNum = String(d.getDate()).padStart(2, "0");
    const monthName = months[d.getMonth()];
    const yearShort = String(d.getFullYear()).slice(-2);
    return `${dayName}, ${dateNum} ${monthName} '${yearShort}`;
  } catch (e) {
    return dateStr;
  }
};

// Map high quality visual assets for ticket posters matching book type / query
const getThumbnailImage = (booking: Booking): string => {
  const title = booking.title.toLowerCase();
  if (booking.type === "movie") {
    if (title.includes("interstellar")) {
      return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=150&h=180&q=80";
    }
    if (title.includes("inception")) {
      return "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=150&h=180&q=80";
    }
    return "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=150&h=180&q=80";
  } else if (booking.type === "hotel") {
    if (title.includes("taj")) {
      return "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=150&h=180&q=80";
    }
    if (title.includes("marriott")) {
      return "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=150&h=180&q=80";
    }
    return "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=150&h=180&q=80";
  } else if (booking.type === "bus") {
    return "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=150&h=180&q=80";
  }
  return "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=150&h=180&q=80";
};

interface ColorTheme {
  primaryRGB: [number, number, number];
  primaryHex: string;
  darkRGB: [number, number, number];
  lightRGB: [number, number, number];
  tealHex: string;
  name: string;
  badgeBg: string;
  badgeBorder: string;
}

export const TICKET_THEMES: Record<string, ColorTheme> = {
  emerald: {
    primaryRGB: [16, 185, 129],
    primaryHex: "bg-emerald-500",
    darkRGB: [6, 150, 99],
    lightRGB: [52, 211, 153],
    tealHex: "text-emerald-100",
    name: "Emerald Green",
    badgeBg: "bg-emerald-600/40",
    badgeBorder: "border-emerald-400/30"
  },
  blue: {
    primaryRGB: [59, 130, 246],
    primaryHex: "bg-blue-500",
    darkRGB: [29, 78, 216],
    lightRGB: [147, 197, 253],
    tealHex: "text-blue-100",
    name: "Sapphire Blue",
    badgeBg: "bg-blue-600/40",
    badgeBorder: "border-blue-400/30"
  },
  purple: {
    primaryRGB: [139, 92, 246],
    primaryHex: "bg-purple-500",
    darkRGB: [109, 40, 217],
    lightRGB: [196, 181, 253],
    tealHex: "text-purple-100",
    name: "Amethyst Purple",
    badgeBg: "bg-purple-600/40",
    badgeBorder: "border-purple-400/30"
  },
  amber: {
    primaryRGB: [249, 115, 22],
    primaryHex: "bg-orange-500",
    darkRGB: [194, 65, 12],
    lightRGB: [253, 186, 116],
    tealHex: "text-orange-100",
    name: "Sunset Orange",
    badgeBg: "bg-orange-600/40",
    badgeBorder: "border-orange-400/30"
  },
  rose: {
    primaryRGB: [244, 63, 94],
    primaryHex: "bg-rose-500",
    darkRGB: [190, 24, 74],
    lightRGB: [253, 164, 175],
    tealHex: "text-rose-100",
    name: "Rose Red",
    badgeBg: "bg-rose-600/40",
    badgeBorder: "border-rose-400/30"
  },
  orange: {
    primaryRGB: [234, 88, 12],
    primaryHex: "bg-orange-600",
    darkRGB: [194, 65, 12],
    lightRGB: [255, 237, 213],
    tealHex: "text-orange-100",
    name: "Vibrant Orange",
    badgeBg: "bg-orange-700/40",
    badgeBorder: "border-orange-400/30"
  },
};

// Generate ticket PDF document resembling the confirmed ticket card layout
export function generateTicketPDF(booking: Booking, userName: string, themeKey: string = "orange") {
  const theme = TICKET_THEMES[themeKey] || TICKET_THEMES.orange;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  let targetName = "";
  let seatDisplay = "";
  let dateDisplay = "";
  let locationLabel = "";
  let timeDisplay = "";
  let tags: string[] = [];

  if (booking.type === "movie") {
    const details = booking.details as MovieDetails;
    targetName = details.movieName;
    seatDisplay = details.seats?.join(", ") || "N/A";
    dateDisplay = formatTicketDate(booking.date);
    timeDisplay = details.showtime || "02:15 PM";
    locationLabel = details.theatreName || "VNS Cine Complex, Beraka Nagar";
    tags = ["U/A", "English", "2D"];
  } else if (booking.type === "bus") {
    const details = booking.details as BusDetails;
    targetName = details.busOperator;
    seatDisplay = details.seats?.join(", ") || "N/A";
    dateDisplay = formatTicketDate(booking.date);
    timeDisplay = "08:30 PM";
    locationLabel = `${details.source} to ${details.destination}`;
    tags = ["Sleeper AC", "GPS Live", "Water"];
  } else if (booking.type === "hotel") {
    const details = booking.details as HotelDetails;
    targetName = details.hotelName;
    seatDisplay = `Room ${details.roomNumber}`;
    dateDisplay = formatTicketDate(details.checkInDate);
    timeDisplay = "12:00 PM Check-In";
    locationLabel = "Luxury Stay & Hospitality Suites";
    tags = ["AC Room", "Free Wifi", "DeLuxe"];
  }

  // Draw Page Background (Soft elegant off-white)
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, "F");

  // Draw main Ticket Pass container box
  const cardX = 20;
  const cardY = 25;
  const cardW = 170;
  const cardH = 220;

  // Outer Shadow / Border line of the card
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.setFillColor(255, 255, 255);
  // Round rect simulation or simple rect
  doc.rect(cardX, cardY, cardW, cardH, "FD");

  // --- 1. Vibrant Theme Confirmed Header Banner ---
  doc.setFillColor(theme.primaryRGB[0], theme.primaryRGB[1], theme.primaryRGB[2]);
  doc.rect(cardX, cardY, cardW, 32, "F");

  // White Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Booking Confirmed", cardX + 10, cardY + 14);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255); // high contrast white
  doc.text("VALID ENTRY PASS - POWERED BY PRAVEEN AI", cardX + 10, cardY + 22);

  // Active status indicator right aligned
  doc.setFillColor(theme.darkRGB[0], theme.darkRGB[1], theme.darkRGB[2]);
  doc.rect(cardX + 138, cardY + 10, 22, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("ACTIVE", cardX + 143, cardY + 14.5);

  // --- 2. Main Ticket Body Content ---
  // Movie / Hotel / Bus Title
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(targetName, cardX + 10, cardY + 45);

  // Draw category badges / tags
  let badgeX = cardX + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // slate-500

  tags.forEach((tag) => {
    const textWidth = doc.getTextWidth(tag);
    const boxW = textWidth + 4;
    // Draw tiny light gray box
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.rect(badgeX, cardY + 49, boxW, 5, "FD");
    
    // Draw text centered
    doc.text(tag, badgeX + 2, cardY + 52.5);
    badgeX += boxW + 2;
  });

  // Theatre / Venue / Routes
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(locationLabel, cardX + 10, cardY + 62);

  // View address hint
  doc.setTextColor(14, 165, 233); // sky-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Verify Address Location Online", cardX + 10, cardY + 67);

  // --- 3. Tear-Line Separator & circular notches ---
  const notchY = cardY + 76;
  // Left white cutout notch
  doc.setFillColor(248, 250, 252); // page background color
  doc.setDrawColor(226, 232, 240);
  doc.ellipse(cardX, notchY, 4, 4, "FD");

  // Right white cutout notch
  doc.ellipse(cardX + cardW, notchY, 4, 4, "FD");

  // Redraw boundaries over ellipses to simulate clean cutouts
  doc.setDrawColor(255, 255, 255);
  doc.line(cardX, notchY - 4, cardX, notchY + 4);
  doc.line(cardX + cardW, notchY - 4, cardX + cardW, notchY + 4);

  // Dashed lines across
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineDashPattern([2, 2], 0);
  doc.line(cardX + 6, notchY, cardX + cardW - 6, notchY);
  doc.setLineDashPattern([], 0); // Reset dash

  // Central tiny label
  doc.setFillColor(255, 255, 255);
  const infoLabel = "SCAN QR CODE FOR ACCESS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const labelWidth = doc.getTextWidth(infoLabel);
  doc.rect(cardX + (cardW / 2) - (labelWidth / 2) - 3, notchY - 2.5, labelWidth + 6, 5, "F");
  doc.text(infoLabel, cardX + (cardW / 2) - (labelWidth / 2), notchY + 1);

  // --- 4. Ticket Details Section ---
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  
  // Passenger info
  doc.text("PASSENGER", cardX + 10, cardY + 89);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(10.5);
  doc.text(userName, cardX + 10, cardY + 95);

  // Date label & value
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8.5);
  doc.text("DATE / SCHEDULE", cardX + 10, cardY + 105);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.text(dateDisplay, cardX + 10, cardY + 111);

  // Time label & value
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8.5);
  doc.text("BOARDING TIME", cardX + 10, cardY + 121);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(timeDisplay, cardX + 10, cardY + 127);

  // Seats label & value
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8.5);
  doc.text("SEATS / ROOMS", cardX + 75, cardY + 105);
  doc.setTextColor(theme.primaryRGB[0], theme.primaryRGB[1], theme.primaryRGB[2]);
  doc.setFontSize(11);
  doc.text(seatDisplay, cardX + 75, cardY + 111);

  // --- 5. Crisp Sharp Vector QR Code on right side ---
  const qX = cardX + 120;
  const qY = cardY + 86;
  const qS = 36; // size

  // QR outer card frame
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(241, 245, 249);
  doc.rect(qX - 3, qY - 3, qS + 6, qS + 6, "FD");

  // Draw realistic QR pattern blocks (anchor boxes) in high definition black vector
  doc.setFillColor(15, 23, 42);
  // Top-left Anchor
  doc.rect(qX, qY, 10, 10, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(qX + 2, qY + 2, 6, 6, "F");
  doc.setFillColor(15, 23, 42);
  doc.rect(qX + 3.5, qY + 3.5, 3, 3, "F");

  // Top-right Anchor
  doc.rect(qX + qS - 10, qY, 10, 10, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(qX + qS - 8, qY + 2, 6, 6, "F");
  doc.setFillColor(15, 23, 42);
  doc.rect(qX + qS - 6.5, qY + 3.5, 3, 3, "F");

  // Bottom-left Anchor
  doc.rect(qX, qY + qS - 10, 10, 10, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(qX + 2, qY + qS - 8, 6, 6, "F");
  doc.setFillColor(15, 23, 42);
  doc.rect(qX + 3.5, qY + qS - 6.5, 3, 3, "F");

  // Simulated internal binary QR blocks for realism
  doc.rect(qX + 12, qY + 2, 4, 4, "F");
  doc.rect(qX + 18, qY + 4, 6, 2, "F");
  doc.rect(qX + 14, qY + 12, 8, 4, "F");
  doc.rect(qX + 24, qY + 10, 4, 8, "F");
  doc.rect(qX + 2, qY + 14, 4, 4, "F");
  doc.rect(qX + 8, qY + 18, 4, 6, "F");
  doc.rect(qX + 14, qY + 20, 6, 4, "F");
  doc.rect(qX + 22, qY + 22, 10, 4, "F");
  doc.rect(qX + 12, qY + 28, 8, 6, "F");
  doc.rect(qX + 22, qY + 30, 4, 4, "F");
  doc.rect(qX + 28, qY + 28, 6, 4, "F");

  // --- 6. Security Identifiers and Barcode area ---
  doc.setDrawColor(241, 245, 249);
  doc.line(cardX + 10, cardY + 142, cardX + cardW - 10, cardY + 142);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.text("SECRET CODE:  CQFGECA", cardX + 10, cardY + 149);
  doc.text(`BOOKING ID:   ${booking.id.toUpperCase().replace("B_", "")}/21465170955`, cardX + 10, cardY + 154);

  // --- 7. Dark Slate Premium Totals Footer Bar ---
  const footerBarY = cardY + cardH - 22;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(cardX, footerBarY, cardW, 22, "F");

  // Amount labels
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL RESERVATION COST (PAID IN FULL)", cardX + 10, footerBarY + 9);

  // Amount Value
  doc.setTextColor(theme.lightRGB[0], theme.lightRGB[1], theme.lightRGB[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`INR Rs. ${booking.price.toLocaleString()}.00`, cardX + 10, footerBarY + 15);

  // Digital secure verified seal on the footer right
  doc.setFillColor(30, 41, 59);
  doc.rect(cardX + cardW - 48, footerBarY + 5, 38, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text("✓ VERIFIED BY BOOKAURA", cardX + cardW - 45, footerBarY + 12.5);

  // Page Outer Footer Info
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("Please keep a printed copy or save this digital boarding pass safe in your device storage.", 34, 260);
  doc.text("BookAura reservation engine is certified, secure, and complies with official ticketing regulations.", 33, 265);

  doc.save(`BookAura_Ticket_${booking.id.toUpperCase()}.pdf`);
}

interface TicketCardProps {
  booking: Booking;
  userName: string;
}

export default function TicketCard({ booking, userName }: TicketCardProps) {
  const isExpiring = isExpiringSoon(booking);
  const [ticketTheme, setTicketTheme] = useState<string>("orange");
  const selectedTheme = TICKET_THEMES[ticketTheme] || TICKET_THEMES.orange;

  const textAmountColors: Record<string, string> = {
    orange: "text-orange-400",
    indigo: "text-indigo-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    amber: "text-orange-400",
    rose: "text-rose-400"
  };

  const btnColors: Record<string, string> = {
    orange: "bg-orange-600 hover:bg-orange-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    emerald: "bg-emerald-500 hover:bg-emerald-600",
    blue: "bg-blue-500 hover:bg-blue-600",
    purple: "bg-purple-500 hover:bg-purple-600",
    amber: "bg-orange-500 hover:bg-orange-600",
    rose: "bg-rose-500 hover:bg-rose-600"
  };

  let targetName = "";
  let seatDisplay = "";
  let dateDisplay = "";
  let locationLabel = "";
  let timeDisplay = "";
  let tags: string[] = [];

  if (booking.type === "movie") {
    const details = booking.details as MovieDetails;
    targetName = details.movieName;
    seatDisplay = details.seats?.join(", ") || "N/A";
    dateDisplay = formatTicketDate(booking.date);
    timeDisplay = details.showtime || "02:15 PM";
    locationLabel = details.theatreName || "VNS Cine Complex, Beraka Nagar";
    tags = ["U/A", "English", "2D"];
  } else if (booking.type === "bus") {
    const details = booking.details as BusDetails;
    targetName = details.busOperator;
    seatDisplay = details.seats?.join(", ") || "N/A";
    dateDisplay = formatTicketDate(booking.date);
    timeDisplay = "08:30 PM";
    locationLabel = `${details.source} to ${details.destination}`;
    tags = ["Sleeper AC", "GPS Live", "Water"];
  } else if (booking.type === "hotel") {
    const details = booking.details as HotelDetails;
    targetName = details.hotelName;
    seatDisplay = `Room ${details.roomNumber}`;
    dateDisplay = formatTicketDate(details.checkInDate);
    timeDisplay = "12:00 PM Check-In";
    locationLabel = "Luxury Stay & Hospitality Suites";
    tags = ["AC Room", "Free Wifi", "DeLuxe"];
  }

  const thumbImg = getThumbnailImage(booking);

  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -5 }}
      transition={{ type: "spring", stiffness: 350, damping: 22 }}
      className="w-full max-w-md mx-auto bg-slate-50 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col font-sans text-slate-800 animate-fade-in relative cursor-pointer"
    >
      
      {/* Expiring Soon Alert Banner */}
      {isExpiring && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2.5 text-xs flex items-center justify-between gap-1.5 animate-pulse relative z-10 border-b border-amber-600/25">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="animate-bounce" />
            <span>EXPIRING SOON - Event starts within 24 Hours!</span>
          </span>
          <span className="bg-slate-950 text-amber-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
            Priority
          </span>
        </div>
      )}

      {/* Vibrant Booking Confirmed Header */}
      <div className={`${selectedTheme.primaryHex} text-white px-6 py-4 flex items-center justify-between relative overflow-hidden transition-all duration-300`}>
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-white/10 rounded-full blur-xl"></div>
        <div className="flex items-center gap-2.5">
          <span className="text-xl md:text-2xl font-black tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Booking Confirmed
          </span>
          <CheckCircle2 size={22} className="text-white shrink-0" />
        </div>
        <span className={`${selectedTheme.badgeBg} ${selectedTheme.tealHex} border ${selectedTheme.badgeBorder} px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-300`}>
          ACTIVE
        </span>
      </div>

      {/* Main Ticket Container Card - matches shared design perfectly */}
      <div className="bg-white px-6 pt-5 pb-4 relative">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-2.5 flex-grow">
            {/* Title */}
            <h4 className="text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
              {targetName}
            </h4>

            {/* Custom tags like U/A, Telugu, 2D */}
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Theater / Location complex */}
            <div className="flex items-center gap-1 text-xs text-slate-600 font-semibold pt-1">
              <MapPin size={12} className="text-slate-400 shrink-0" />
              <span>{locationLabel}</span>
            </div>
            <button className="text-[11px] font-bold text-sky-500 hover:text-sky-600 transition-colors block">
              View Address
            </button>
          </div>

          {/* Right side poster / visual thumbnail thumbnail */}
          <div className="w-20 h-24 rounded-2xl overflow-hidden shadow-md shrink-0 border border-slate-100">
            <img
              src={thumbImg}
              alt={targetName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Ticket Tear-Line Divider with Side Cutout Notches */}
      <div className="relative py-2 bg-white flex items-center justify-center overflow-hidden">
        {/* Left notch */}
        <div className="absolute left-0 -ml-3 w-6 h-6 bg-slate-50 border-r border-slate-100 rounded-full z-10"></div>
        {/* Right notch */}
        <div className="absolute right-0 -mr-3 w-6 h-6 bg-slate-50 border-l border-slate-100 rounded-full z-10"></div>
        
        {/* Dashed line */}
        <div className="w-full border-t border-dashed border-slate-200 flex justify-center relative">
          <span className="absolute -top-2.5 bg-white px-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">
            SCAN QR CODE FOR ACCESS
          </span>
        </div>
      </div>

      {/* Lower Ticket Section */}
      <div className="bg-white px-6 pb-5 pt-3">
        <div className="grid grid-cols-3 gap-2 items-center">
          {/* Col 1 & 2: Details */}
          <div className="col-span-2 space-y-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Date & Time
              </span>
              <span className="text-xs font-bold text-slate-800 block">
                {dateDisplay}
              </span>
              <span className="text-sm font-black text-slate-900 block mt-0.5">
                {timeDisplay}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Seats Assigned
              </span>
              <span className="text-xs font-extrabold text-slate-800 block">
                {seatDisplay}
              </span>
            </div>
          </div>

          {/* Col 3: Beautiful, clean Vector SVG QR Code on the right */}
          <div className="flex justify-end">
            <div className="bg-slate-50 p-2 border border-slate-100 rounded-2xl shadow-sm hover:scale-105 transition-transform duration-300">
              <svg className="w-20 h-20 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                <rect x="0" y="0" width="24" height="24" rx="2" />
                <rect x="4" y="4" width="16" height="16" rx="1" fill="white" />
                <rect x="8" y="8" width="8" height="8" rx="0.5" />

                <rect x="76" y="0" width="24" height="24" rx="2" />
                <rect x="80" y="4" width="16" height="16" rx="1" fill="white" />
                <rect x="84" y="8" width="8" height="8" rx="0.5" />

                <rect x="0" y="76" width="24" height="24" rx="2" />
                <rect x="4" y="80" width="16" height="16" rx="1" fill="white" />
                <rect x="84" y="80" width="8" height="8" rx="0.5" />

                {/* Simulated high density blocks */}
                <rect x="30" y="4" width="8" height="8" />
                <rect x="44" y="8" width="12" height="6" />
                <rect x="62" y="4" width="6" height="16" />
                <rect x="30" y="16" width="16" height="8" />
                <rect x="52" y="18" width="10" height="12" />

                <rect x="76" y="30" width="10" height="10" />
                <rect x="90" y="36" width="8" height="12" />
                <rect x="84" y="52" width="12" height="6" />

                <rect x="4" y="30" width="12" height="8" />
                <rect x="20" y="36" width="6" height="12" />
                <rect x="12" y="52" width="16" height="6" />

                <rect x="30" y="40" width="30" height="10" />
                <rect x="30" y="54" width="10" height="30" />
                <rect x="46" y="58" width="20" height="10" />
                <rect x="46" y="74" width="16" height="16" />
                <rect x="66" y="74" width="28" height="8" />
                <rect x="72" y="86" width="12" height="8" />
              </svg>
            </div>
          </div>
        </div>

        {/* Secret code and Booking ID on the bottom of the card */}
        <div className="border-t border-slate-100 mt-4 pt-3.5 flex flex-col sm:flex-row sm:justify-between gap-1 text-[10px] text-slate-400 font-mono">
          <div>
            <span className="font-bold text-slate-500">SECRET CODE: </span>
            <span className="font-black text-slate-700 tracking-wider">CQFGECA</span>
          </div>
          <div>
            <span className="font-bold text-slate-500">BOOKING ID: </span>
            <span className="font-black text-slate-700">{booking.id.toUpperCase().replace("B_", "")}/21465170955</span>
          </div>
        </div>
      </div>

      {/* Theme customization bar */}
      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:bg-zinc-900/40 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-slate-500 dark:text-zinc-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">Customize Ticket Color:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(TICKET_THEMES).map(([key, themeObj]) => {
            const isSelected = ticketTheme === key;
            const colorDotClasses: Record<string, string> = {
              orange: "bg-orange-600",
              indigo: "bg-indigo-600",
              emerald: "bg-emerald-500",
              blue: "bg-blue-500",
              purple: "bg-purple-500",
              rose: "bg-rose-500"
            };
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTicketTheme(key)}
                title={themeObj.name}
                className={`w-6 h-6 rounded-full ${colorDotClasses[key]} transition-all flex items-center justify-center cursor-pointer ${
                  isSelected ? "ring-2 ring-slate-900 ring-offset-2 dark:ring-white scale-110" : "opacity-75 hover:opacity-100 hover:scale-105"
                }`}
              >
                {isSelected && <Check size={10} className="text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions footer block */}
      <div className="bg-slate-900 px-6 py-3.5 flex justify-between items-center text-xs text-white border-t border-slate-800">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">TOTAL AMOUNT</span>
          <span className={`text-sm font-black ${textAmountColors[ticketTheme]}`}>₹{booking.price.toLocaleString()}</span>
        </div>
        <button
          onClick={() => generateTicketPDF(booking, userName, ticketTheme)}
          className={`${btnColors[ticketTheme]} text-white font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer text-xs`}
        >
          <Download size={13} />
          <span>Download PDF Pass</span>
        </button>
      </div>

    </motion.div>
  );
}
