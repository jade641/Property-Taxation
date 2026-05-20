import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { getAuthApiErrorMessage, resetPasswordRequest } from "../services/authService";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const initialOtp = searchParams.get("otp") ?? "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialOtp);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const message = await resetPasswordRequest({
        email,
        otp,
        newPassword,
      });
      setSuccessMessage(message);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(getAuthApiErrorMessage(err));
    } finally {
      setLoading(false);
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
                <h2 className="text-slate-900">Reset Password</h2>
              </div>
              <p className="text-sm text-slate-500 mt-2 ml-0.5">
                Enter the OTP and create a new password.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-700">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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
                <label className="block text-sm text-slate-700 mb-1.5">OTP</label>
                <div className="relative">
                  <input
                    type="text"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Create a strong password"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((current) => !current)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Updating password...
                  </>
                ) : (
                  "Reset Password"
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
