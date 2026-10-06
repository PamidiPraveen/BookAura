import React, { useState, useEffect } from "react";
import { CreditCard, Smartphone, CheckCircle, RefreshCw, X, Shield, QrCode } from "lucide-react";

interface RazorpayModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingInfo: {
    title: string;
    price: number;
    type: string;
    details: any;
  };
  onPaymentSuccess: (paymentMethod: string) => void;
}

export default function RazorpayModal({
  isOpen,
  onClose,
  bookingInfo,
  onPaymentSuccess
}: RazorpayModalProps) {
  const [activeTab, setActiveTab] = useState<"card" | "upi" | "qr" | "netbanking">("upi");
  const [paymentState, setPaymentState] = useState<"form" | "processing" | "success">("form");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVV, setCardCVV] = useState("");
  const [cardName, setCardName] = useState("");
  const [upiId, setUpiId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPaymentState("form");
      setCardNumber("");
      setCardExpiry("");
      setCardCVV("");
      setCardName("");
      setUpiId("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentState("processing");

    // Simulate standard Razorpay processing delay (1.8s)
    setTimeout(() => {
      setPaymentState("success");
      // Simulate success checkmark delay
      setTimeout(() => {
        let method = "RazorPay";
        if (activeTab === "upi") method = `UPI (${upiId || "customer@okaxis"})`;
        else if (activeTab === "card") method = `Visa Card (Ending *${cardNumber.slice(-4) || "4242"})`;
        else if (activeTab === "qr") method = "Razorpay QR Code Scan";
        else method = "Razorpay Netbanking";

        onPaymentSuccess(method);
      }, 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-800">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* RazorPay Branded Header */}
        <div className="bg-[#0b132b] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black text-xl italic tracking-tighter text-white">R</div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-blue-400 uppercase">Razorpay Checkout</h3>
              <p className="text-xs text-slate-300">Secured by Razorpay • Booking Platform</p>
            </div>
          </div>
          {paymentState === "form" && (
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Booking Amount Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-400 font-semibold uppercase tracking-wider block">PURCHASE ITEM</span>
            <span className="text-slate-800 font-semibold text-sm max-w-[200px] truncate block">{bookingInfo.title}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 font-semibold uppercase tracking-wider block">AMOUNT</span>
            <span className="text-slate-800 font-bold text-base">₹{bookingInfo.price.toLocaleString()}</span>
          </div>
        </div>

        {/* Content Area based on Payment State */}
        {paymentState === "form" && (
          <div className="flex flex-1 flex-col md:flex-row overflow-y-auto">
            
            {/* Payment Method Selector Sidebar */}
            <div className="w-full md:w-2/5 flex md:flex-col border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("upi")}
                className={`flex-1 md:flex-none px-3 py-3 md:py-3.5 flex items-center justify-center md:justify-start gap-1.5 text-xs font-semibold border-r md:border-r-0 md:border-b border-slate-100 text-center md:text-left transition-colors cursor-pointer ${
                  activeTab === "upi" ? "bg-white text-blue-600 border-b-2 md:border-b-0 md:border-l-4 border-blue-500" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Smartphone size={15} />
                <span>UPI ID</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`flex-1 md:flex-none px-3 py-3 md:py-3.5 flex items-center justify-center md:justify-start gap-1.5 text-xs font-semibold border-r md:border-r-0 md:border-b border-slate-100 text-center md:text-left transition-colors cursor-pointer ${
                  activeTab === "card" ? "bg-white text-blue-600 border-b-2 md:border-b-0 md:border-l-4 border-blue-500" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CreditCard size={15} />
                <span>Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className={`flex-1 md:flex-none px-3 py-3 md:py-3.5 flex items-center justify-center md:justify-start gap-1.5 text-xs font-semibold border-b border-slate-100 text-center md:text-left transition-colors cursor-pointer ${
                  activeTab === "qr" ? "bg-white text-blue-600 border-b-2 md:border-b-0 md:border-l-4 border-blue-500" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <QrCode size={15} />
                <span>QR Code</span>
              </button>
            </div>

            {/* Payment Method Details Form */}
            <form onSubmit={handlePaymentSubmit} className="flex-1 p-6 flex flex-col justify-between">
              <div>
                {activeTab === "upi" && (
                  <div className="animate-fade-in space-y-4">
                    <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Pay via UPI</h4>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">UPI Address (VPA)</label>
                      <input
                        type="text"
                        placeholder="username@okhdfcbank"
                        required
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Example: mobileNo@upi or username@okaxis</p>
                    </div>
                  </div>
                )}

                {activeTab === "card" && (
                  <div className="animate-fade-in space-y-3">
                    <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Card Details</h4>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Cardholder Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        required
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Card Number</label>
                      <input
                        type="text"
                        maxLength={16}
                        placeholder="4111 2222 3333 4444"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\s+/g, ""))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-800 font-mono font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="MM/YY"
                          required
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-800 font-medium text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">CVV / CVC</label>
                        <input
                          type="password"
                          maxLength={3}
                          placeholder="***"
                          required
                          value={cardCVV}
                          onChange={(e) => setCardCVV(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-slate-800 font-medium text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "qr" && (
                  <div className="animate-fade-in flex flex-col items-center justify-center py-2 text-center">
                    <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-2">Scan QR Code</h4>
                    <div className="relative p-2 bg-white border border-slate-200 rounded-xl shadow-inner mb-2">
                      {/* Interactive pulsing scan animation overlay */}
                      <div className="absolute inset-x-2 top-2 h-0.5 bg-blue-500 animate-bounce"></div>
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=bookaura@razorpay%26pn=BookAura%26am=1"
                        alt="Razorpay QR Code"
                        className="w-32 h-32"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 max-w-[200px]">Scan with any BHIM UPI App like GooglePay, PhonePe, or Paytm to pay ₹{bookingInfo.price.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Submit Checkout Button */}
              <button
                type="submit"
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-100 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield size={16} />
                <span>Pay ₹{bookingInfo.price.toLocaleString()} Securely</span>
              </button>
            </form>
          </div>
        )}

        {/* Processing Spinner State */}
        {paymentState === "processing" && (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
            <RefreshCw size={48} className="text-blue-500 animate-spin" />
            <div>
              <h4 className="font-bold text-slate-800 text-base">Processing Transaction</h4>
              <p className="text-xs text-slate-400 mt-1">Please do not refresh this window or click back button...</p>
            </div>
            <div className="w-4/5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse w-2/3 rounded-full"></div>
            </div>
          </div>
        )}

        {/* Payment Confirmed Success State */}
        {paymentState === "success" && (
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
            <CheckCircle size={64} className="text-orange-500 animate-bounce" />
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Payment Successful!</h4>
              <p className="text-xs text-slate-500 mt-1">Razorpay transaction verified. Issuing your tickets...</p>
            </div>
            <div className="bg-orange-50 text-orange-800 rounded-xl px-4 py-2 text-xs font-semibold">
              Ref ID: TXN_RP_{Math.floor(100000 + Math.random() * 900000)}
            </div>
          </div>
        )}

        {/* Razorpay Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1">🛡️ SSL 256-bit Encryption</span>
          <span>Powered by Razorpay</span>
        </div>

      </div>
    </div>
  );
}
