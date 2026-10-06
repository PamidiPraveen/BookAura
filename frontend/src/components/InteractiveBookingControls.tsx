import React, { useState } from "react";
import { Check, Armchair, Hotel, Trash2, ShieldCheck, CreditCard, Send } from "lucide-react";

interface InteractiveBookingControlsProps {
  actionType: "select_movie_seats" | "select_bus_seats" | "select_hotel_options";
  actionData: any;
  onConfirm: (summaryText: string, finalData: any) => void;
}

export default function InteractiveBookingControls({
  actionType,
  actionData,
  onConfirm
}: InteractiveBookingControlsProps) {
  // Movie/Bus Seat Selection State
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  
  // Hotel Preference State
  const [roomType, setRoomType] = useState<"AC" | "Non-AC">("AC");
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  // Grid sizes
  // Movie Seat Map: 6 rows (A-F), 10 columns (1-10)
  const movieRows = ["A", "B", "C", "D", "E", "F"];
  const movieCols = Array.from({ length: 10 }, (_, i) => i + 1);

  // Bus Seat Map: 2x2 layout, 8 rows
  const busRows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const busSides = ["Window L", "Aisle L", "Aisle R", "Window R"];

  // Hotel rooms available
  const hotelRooms = actionData?.availableRooms || ["101", "102", "104", "110", "201", "204", "301", "305"];

  const handleSeatClick = (seatCode: string) => {
    if (selectedSeats.includes(seatCode)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatCode));
    } else {
      setSelectedSeats([...selectedSeats, seatCode]);
    }
  };

  const calculateTotalPrice = () => {
    const basePrice = actionData?.price || 250;
    if (actionType === "select_hotel_options") {
      return basePrice + (roomType === "AC" ? 1000 : 0);
    }
    return basePrice * selectedSeats.length;
  };

  const handleConfirm = () => {
    const finalPrice = calculateTotalPrice();
    if (actionType === "select_movie_seats") {
      if (selectedSeats.length === 0) return;
      const summary = `I have selected movie seats: ${selectedSeats.join(", ")}. Total Price: ₹${finalPrice}. Let's proceed to secure payment!`;
      onConfirm(summary, {
        type: "movie",
        title: `${actionData.movieName} at ${actionData.theatreName}`,
        price: finalPrice,
        details: {
          movieName: actionData.movieName,
          theatreName: actionData.theatreName,
          showtime: actionData.showtime,
          seats: selectedSeats
        }
      });
    } else if (actionType === "select_bus_seats") {
      if (selectedSeats.length === 0) return;
      const summary = `I have selected bus seats: ${selectedSeats.join(", ")}. Total Price: ₹${finalPrice}. Let's proceed to payment!`;
      onConfirm(summary, {
        type: "bus",
        title: `${actionData.busOperator} Ticket`,
        price: finalPrice,
        details: {
          busOperator: actionData.busOperator,
          source: actionData.source,
          destination: actionData.destination,
          busType: `${roomType === "AC" ? "AC" : "Non-AC"} Sleeper`,
          seats: selectedSeats,
          departureDate: actionData.departureDate || new Date().toISOString().split("T")[0]
        }
      });
    } else if (actionType === "select_hotel_options") {
      if (!selectedRoom) return;
      const summary = `I prefer a ${roomType} Room, and selected Room No: ${selectedRoom}. Total Price: ₹${finalPrice}. Ready for payment!`;
      onConfirm(summary, {
        type: "hotel",
        title: `${actionData.hotelName} Stay`,
        price: finalPrice,
        details: {
          hotelName: actionData.hotelName,
          roomType: roomType,
          roomNumber: selectedRoom,
          checkInDate: actionData.checkInDate || new Date().toISOString().split("T")[0],
          checkOutDate: actionData.checkOutDate || new Date(Date.now() + 86400000).toISOString().split("T")[0]
        }
      });
    }
  };

  return (
    <div className="my-4 bg-white/95 backdrop-blur-md rounded-2xl border border-orange-100 p-5 shadow-lg max-w-xl mx-auto overflow-hidden animate-fade-in text-slate-800">
      
      {/* Movie Seat Selection */}
      {actionType === "select_movie_seats" && (
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="font-semibold text-orange-900 text-lg">{actionData.movieName}</h4>
              <p className="text-xs text-slate-500">{actionData.theatreName} • {actionData.showtime}</p>
            </div>
            <span className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              ₹{actionData.price || 250}/seat
            </span>
          </div>

          <p className="text-center text-xs text-slate-400 tracking-widest uppercase mb-4 py-1 bg-slate-50 rounded">SCREEN THIS WAY</p>

          {/* Seat Grid */}
          <div className="flex flex-col gap-1.5 justify-center items-center overflow-x-auto py-2">
            {movieRows.map(row => (
              <div key={row} className="flex gap-1.5 items-center">
                <span className="w-5 text-xs font-bold text-slate-400 text-center">{row}</span>
                {movieCols.map(col => {
                  const seatCode = `${row}${col}`;
                  const isSelected = selectedSeats.includes(seatCode);
                  // Mock some reserved seats
                  const isReserved = (row === "C" && col > 3 && col < 7) || (row === "A" && col === 1);
                  return (
                    <button
                      key={seatCode}
                      disabled={isReserved}
                      onClick={() => handleSeatClick(seatCode)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-semibold transition-all duration-200 cursor-pointer ${
                        isReserved
                          ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                          : isSelected
                          ? "bg-orange-600 text-white shadow-md scale-110 shadow-orange-200"
                          : "bg-slate-50 hover:bg-orange-50 text-slate-700 border border-slate-200 hover:border-orange-300"
                      }`}
                      title={seatCode}
                    >
                      {col}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-orange-600 inline-block"></span>
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-200 inline-block"></span>
              <span>Reserved</span>
            </div>
          </div>
        </div>
      )}

      {/* Bus Seat Selection */}
      {actionType === "select_bus_seats" && (
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="font-semibold text-orange-900 text-lg">{actionData.busOperator}</h4>
              <p className="text-xs text-slate-500">{actionData.source} to {actionData.destination}</p>
            </div>
            <span className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              ₹{actionData.price || 850}/seat
            </span>
          </div>

          <p className="text-center text-xs text-slate-400 tracking-widest uppercase mb-4 py-1 bg-slate-50 rounded">FRONT OF THE BUS (DRIVER SIDE)</p>

          <div className="flex flex-col gap-2 items-center bg-slate-50 p-3 rounded-xl max-w-sm mx-auto">
            {busRows.map((row, idx) => {
              return (
                <div key={row} className="grid grid-cols-5 gap-2 w-full items-center">
                  <span className="text-xs font-bold text-slate-400 text-center">{idx + 1}</span>
                  
                  {/* Left row (2 seats) */}
                  {Array.from({ length: 2 }).map((_, sIdx) => {
                    const seatNum = `${idx * 4 + sIdx + 1}`;
                    const isSelected = selectedSeats.includes(seatNum);
                    const isReserved = idx === 2 || (idx === 4 && sIdx === 1);
                    return (
                      <button
                        key={seatNum}
                        disabled={isReserved}
                        onClick={() => handleSeatClick(seatNum)}
                        className={`h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                          isReserved
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : isSelected
                            ? "bg-orange-600 text-white shadow-md scale-105"
                            : "bg-white hover:bg-orange-50 text-slate-700 border border-slate-200 hover:border-orange-300"
                        }`}
                      >
                        <Armchair size={14} className="mr-0.5 inline" />
                        {seatNum}
                      </button>
                    );
                  })}

                  {/* Aisle Spacer */}
                  <div className="w-full text-center text-[9px] font-bold text-slate-300">AISLE</div>

                  {/* Right row (2 seats) */}
                  {Array.from({ length: 2 }).map((_, sIdx) => {
                    const seatNum = `${idx * 4 + sIdx + 3}`;
                    const isSelected = selectedSeats.includes(seatNum);
                    const isReserved = idx === 5 && sIdx === 0;
                    return (
                      <button
                        key={seatNum}
                        disabled={isReserved}
                        onClick={() => handleSeatClick(seatNum)}
                        className={`h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                          isReserved
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : isSelected
                            ? "bg-orange-600 text-white shadow-md scale-105"
                            : "bg-white hover:bg-orange-50 text-slate-700 border border-slate-200 hover:border-orange-300"
                        }`}
                      >
                        <Armchair size={14} className="mr-0.5 inline" />
                        {seatNum}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hotel Room Options */}
      {actionType === "select_hotel_options" && (
        <div>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
            <div>
              <h4 className="font-semibold text-orange-900 text-lg">{actionData.hotelName}</h4>
              <p className="text-xs text-slate-500">Select Room Type & Preferred Room No.</p>
            </div>
            <span className="bg-orange-50 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              Base: ₹{actionData.price || 3500}/night
            </span>
          </div>

          {/* AC / Non AC Toggle */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Room Type Preference</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRoomType("AC")}
                className={`py-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  roomType === "AC"
                    ? "bg-orange-50 border-orange-500 text-orange-800 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Hotel className="mb-1 text-orange-600" size={20} />
                <span className="font-semibold text-sm">AC Rooms</span>
                <span className="text-[10px] text-orange-600 font-medium">+₹1,000 / Night</span>
              </button>
              <button
                onClick={() => setRoomType("Non-AC")}
                className={`py-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  roomType === "Non-AC"
                    ? "bg-orange-50 border-orange-500 text-orange-800 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Hotel className="mb-1 text-slate-400" size={20} />
                <span className="font-semibold text-sm">Non-AC Rooms</span>
                <span className="text-[10px] text-slate-400">Standard Pricing</span>
              </button>
            </div>
          </div>

          {/* Room Number Grid */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Preferred Room No.</label>
            <div className="grid grid-cols-4 gap-2">
              {hotelRooms.map((room: string) => {
                const isSelected = selectedRoom === room;
                return (
                  <button
                    key={room}
                    onClick={() => setSelectedRoom(room)}
                    className={`py-2 rounded-lg border text-center font-semibold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "bg-orange-600 border-orange-500 text-white shadow-md scale-105"
                        : "bg-white border-slate-200 text-slate-700 hover:border-orange-300"
                    }`}
                  >
                    Room {room}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Area */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Total Amount</p>
          <p className="text-xl font-bold text-slate-800">
            ₹{calculateTotalPrice().toLocaleString()}
          </p>
        </div>

        <button
          onClick={handleConfirm}
          disabled={
            (actionType !== "select_hotel_options" && selectedSeats.length === 0) ||
            (actionType === "select_hotel_options" && !selectedRoom)
          }
          className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md transition-all cursor-pointer ${
            (actionType !== "select_hotel_options" && selectedSeats.length === 0) ||
            (actionType === "select_hotel_options" && !selectedRoom)
              ? "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed"
              : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200 hover:-translate-y-0.5"
          }`}
        >
          <span>Confirm Selection</span>
          <Send size={14} />
        </button>
      </div>

    </div>
  );
}
