import React, { useState } from "react";
import { Star, CheckCircle, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface StarRatingWidgetProps {
  bookingId: string;
  bookingTitle: string;
  onSubmitted?: (rating: number, comment: string) => void;
}

export default function StarRatingWidget({ bookingId, bookingTitle, onSubmitted }: StarRatingWidgetProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const getFeedbackLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return "Terrible";
      case 2:
        return "Poor";
      case 3:
        return "Fair";
      case 4:
        return "Good";
      case 5:
        return "Excellent!";
      default:
        return "Rate your experience";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setIsSubmitted(true);
    if (onSubmitted) {
      onSubmitted(rating, comment);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-sm text-slate-800 font-sans">
      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <motion.form
            key="feedback-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <div className="text-center">
              <span className="text-[10px] uppercase font-black tracking-widest text-orange-600 block">
                How was your booking?
              </span>
              <p className="text-xs font-bold text-slate-700 mt-0.5 line-clamp-1">
                Rate your booking for {bookingTitle}
              </p>
            </div>

            {/* Stars selection group */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer focus:outline-none transition-transform"
                    >
                      <motion.div
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.9 }}
                        animate={{
                          scale: rating === star ? [1, 1.3, 1] : 1,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <Star
                          size={24}
                          className={`transition-colors duration-150 ${
                            isActive
                              ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]"
                              : "text-slate-300 hover:text-slate-400"
                          }`}
                        />
                      </motion.div>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
                {getFeedbackLabel(hoverRating || rating)}
              </span>
            </div>

            {/* Optional Comment Input - appears once rated */}
            {rating > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2 overflow-hidden"
              >
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us more (optional)..."
                  className="w-full min-h-[50px] p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-100 transition-all cursor-pointer"
                >
                  <Send size={11} />
                  <span>Submit Feedback</span>
                </button>
              </motion.div>
            )}
          </motion.form>
        ) : (
          <motion.div
            key="feedback-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4 space-y-2 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <CheckCircle size={32} className="text-orange-600" />
            </motion.div>
            <div>
              <p className="text-xs font-black text-slate-800">Feedback Submitted!</p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-[200px]">
                Thank you for helping us improve BookAura AI.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
