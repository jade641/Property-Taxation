import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, ArrowLeft, CheckCircle, Mail, ShieldCheck } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { forgotPasswordRequest, getAuthApiErrorMessage, verifyOtpRequest } from "../services/authService";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 10 * 60;

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const isExpired = secondsLeft <= 0;
  const otpDisplay = useMemo(() => otp.replace(/\D/g, "").slice(0, OTP_LENGTH), [otp]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Email address is required.");
      return;
    }

    if (otpDisplay.length !== OTP_LENGTH) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      await verifyOtpRequest({ email, otp: otpDisplay });
      setSuccess("OTP verified successfully.");
      navigate(`/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otpDisplay)}`);
    } catch (err) {
      setError(getAuthApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    setResending(true);

    try {
      await forgotPasswordRequest({ email });
      setSecondsLeft(OTP_TTL_SECONDS);
      setOtp("");
      setSuccess("A new OTP has been sent.");
    } catch (err) {
      setError(getAuthApiErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -translate-x-48 -translate-y-48 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full translate-x-48 translate-y-48 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <BrandLogo variant="mark" className="w-28 h-28 shadow-2xl shadow-slate-950/60 ring-2 ring-white/20" />
          <div className="text-center">
            <p className="text-white font-extrabold text-xl tracking-tight leading-none">TaxSync</p>
            <p className="text-blue-300/80 text-xs font-medium mt-0.5 tracking-wide">Property Tax System</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          <div className="p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-slate-900">Verify OTP</h2>
              </div>
              <p className="text-sm text-slate-500 mt-2 ml-0.5">
                Enter the 6-digit code sent to your email address.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your registered email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5">OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                  placeholder="000000"
                  maxLength={OTP_LENGTH}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Expires in {formatSeconds(secondsLeft)}</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60"
                  >
                    {resending ? "Sending..." : "Resend OTP"}
                  </button>
                </div>
                {isExpired && <p className="mt-2 text-xs text-amber-700">The OTP has expired. Request a new code.</p>}
              </div>

              <button
                type="submit"
                disabled={loading || otpDisplay.length !== OTP_LENGTH || isExpired}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying OTP...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2026 TaxFlow ERP Systems · Authorized Users Only
        </p>
      </div>
    </div>
  );
}
