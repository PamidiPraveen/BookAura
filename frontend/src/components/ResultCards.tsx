import React from "react";
import { Star, MapPin, Clock, Bus as BusIcon, Hotel as HotelIcon } from "lucide-react";

interface Props {
  data: any;
  onPick: (message: string) => void;
}

export default function ResultCards({ data, onPick }: Props) {
  if (data.kind === "movies") {
    return (
      <div className="space-y-3 max-w-xl mx-auto">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Trending now near {data.area}
        </p>
        {data.items.map((m: any) => (
          <div key={m.id} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-3 flex gap-3">
            {m.poster ? (
              <img src={m.poster} alt={m.title} className="w-20 h-28 object-cover rounded-lg shrink-0" />
            ) : (
              <div className="w-20 h-28 rounded-lg bg-slate-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-800 text-sm">{m.title}</h4>
                <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 shrink-0">
                  <Star size={11} fill="currentColor" /> {m.rating}
                </span>
              </div>
              {m.shows.length === 0 && <p className="text-xs text-slate-400 mt-2">No theatres found nearby.</p>}
              {m.shows.map((s: any) => (
                <div key={s.theatre} className="mt-2">
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <MapPin size={10} /> <strong>{s.theatre}</strong> · {s.distanceKm} km · ₹{s.price}
                  </p>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {s.showtimes.map((t: string) => (
                      <button
                        key={t}
                        onClick={() => onPick(`Book "${m.title}" at ${s.theatre} for the ${t} show, ₹${s.price} per seat`)}
                        className="px-2 py-0.5 text-[11px] font-bold rounded border border-green-300 text-green-700 hover:bg-green-50 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.kind === "hotels") {
    return (
      <div className="space-y-3 max-w-xl mx-auto">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Stays near {data.area}
        </p>
        {data.items.map((h: any) => (
          <div key={h.name + h.lat} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <HotelIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 text-sm truncate">{h.name}</h4>
              <p className="text-[11px] text-slate-500">
                {h.type} · {h.distanceKm} km away{h.address ? ` · ${h.address}` : ""}
              </p>
              <p className="text-xs font-bold text-slate-700 mt-0.5">₹{h.pricePerNight}/night</p>
            </div>
            <button
              onClick={() => onPick(`I want to book ${h.name} at ₹${h.pricePerNight} per night. Available rooms: ${h.availableRooms.join(", ")}`)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
            >
              Book
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (data.kind === "buses") {
    return (
      <div className="space-y-3 max-w-xl mx-auto">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {data.source} → {data.destination} · {data.date} · ~{data.distanceKm} km
        </p>
        {data.buses.map((b: any) => (
          <div key={b.operator} className="bg-white rounded-2xl border border-orange-100 shadow-sm p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <BusIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <h4 className="font-bold text-slate-800 text-sm">{b.operator}</h4>
                  <span className="text-sm font-extrabold text-slate-800">₹{b.price}</span>
                </div>
                <p className="text-[11px] text-slate-500">{b.busType}</p>
                <p className="text-xs text-slate-700 mt-1 flex items-center gap-1">
                  <Clock size={11} /> {b.departure} → {b.arrival}{b.arrivesNextDay ? " (+1)" : ""} · {b.duration}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-500">
                    <Star size={10} className="inline text-amber-500" fill="currentColor" /> {b.rating} · {b.seatsLeft} seats left
                  </span>
                  <button
                    onClick={() => onPick(`Book ${b.operator} bus from ${data.source} to ${data.destination} on ${data.date} departing ${b.departure}, ₹${b.price} per seat`)}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
                  >
                    Select seats
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
