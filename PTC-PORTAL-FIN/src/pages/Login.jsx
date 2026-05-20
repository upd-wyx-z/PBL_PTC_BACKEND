import React, { useState, useRef } from 'react';
import { 
  User, Lock, AlertCircle, Loader2, FileSpreadsheet, FileText, Shield, Eye, EyeOff, Key
} from 'lucide-react';

// ============================================================
//  Login.jsx — Connected to Backend (2-Step MFA)
//  Step 1: POST /api/auth/login -> Sends OTP
//  Step 2: POST /api/auth/verify-otp -> Gets Session & User
// ============================================================

const API_BASE = '/api';

export default function LoginView({ onLogin }) {
  // Step Management
  const [step, setStep]                 = useState(1); // 1 = Email/Pass, 2 = OTP
  
  // Form Data
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [otpCode, setOtpCode]           = useState('');
  
  // UI States
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');
  const [successMsg, setSuccessMsg]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [limitWarning, setLimitWarning] = useState('');

  // ── NEW: Reference for the password field to jump focus ──
  const passwordInputRef = useRef(null);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    if (val.length >= 50) {
      setLimitWarning('Maximum limit reached for Email Address.');
      setTimeout(() => setLimitWarning(''), 3000);
      setEmail(val.slice(0, 50));
    } else {
      setEmail(val);
    }
  };

  // ── NEW: Handler to catch the Enter key on Email field ──
  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent the form from submitting
      if (passwordInputRef.current) {
        passwordInputRef.current.focus(); // Jump to password field
      }
    }
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    if (val.length >= 50) {
      setLimitWarning('Maximum limit reached for Password.');
      setTimeout(() => setLimitWarning(''), 3000);
      setPassword(val.slice(0, 50));
    } else {
      setPassword(val);
    }
  };

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, ''); // Only allow numbers
    if (val.length <= 6) setOtpCode(val);
  };

  // ── STEP 1: VERIFY PASSWORD & REQUEST OTP ──
  const handleStepOneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed. Please try again.');
        setIsLoading(false);
        return;
      }

      // Success — Move to Step 2
      setSuccessMsg(data.message); // "OTP sent to email..."
      setStep(2);
      setIsLoading(false);

    } catch (err) {
      setError('Cannot connect to the server. Please make sure the backend is running.');
      setIsLoading(false);
    }
  };

  // ── STEP 2: VERIFY OTP & COMPLETE LOGIN ──
  const handleStepTwoSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include', // IMPORTANT: receives session cookie
        body:        JSON.stringify({ email, otp_code: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Invalid OTP code.');
        setIsLoading(false);
        return;
      }

      // Final Success — pass the real user object up to App.jsx
      onLogin(data.user);

    } catch (err) {
      setError('Cannot connect to the server.');
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep(1);
    setOtpCode('');
    setError('');
    setSuccessMsg('');
  };
  
  return (
    <div className="min-h-screen flex bg-white relative">

      {limitWarning && (
        <div className="fixed top-6 right-6 sm:top-10 sm:right-10 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-xl shadow-2xl z-[100] flex items-center animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="text-yellow-600 mr-3 shrink-0" size={20} />
          <p className="text-sm text-yellow-800 font-bold">{limitWarning}</p>
        </div>
      )}
      
      {/* LEFT SIDE: Brand & Info (Unchanged) */}
      <div className="hidden lg:flex lg:w-1/3 text-white flex-col justify-center px-8 xl:px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: 'url("/ptc-building.png")' }}></div>
        <div className="absolute inset-0 bg-green-950/80 backdrop-blur-sm z-0"></div>
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 z-0"></div>
        
        <div className="relative z-30 flex flex-col items-center w-full">
          <img src="/ptc-logo.png" alt="PTC Logo" className="w-24 h-24 xl:w-32 xl:h-32 object-contain mb-6 drop-shadow-xl" onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 className="text-xl xl:text-2xl 2xl:text-3xl font-bold mb-4 tracking-wide whitespace-nowrap text-yellow-400 drop-shadow-md text-center">
            PATEROS TECHNOLOGICAL COLLEGE
          </h1>
          <p className="text-sm xl:text-base text-white font-medium mb-10 max-w-sm drop-shadow-md text-center">
            A secure, centralized portal for faculty grade encoding, resource management, and administrative approvals.
          </p>
          <div className="space-y-6 flex flex-col items-start w-max">
            <div className="flex items-center text-white"><div className="bg-green-900/70 backdrop-blur-md border border-green-600/50 p-2 rounded-lg mr-4 shadow-lg"><FileSpreadsheet className="text-yellow-400" size={20} /></div><span className="text-sm xl:text-base font-medium drop-shadow-md">Secure Grade Encoding</span></div>
            <div className="flex items-center text-white"><div className="bg-green-900/70 backdrop-blur-md border border-green-600/50 p-2 rounded-lg mr-4 shadow-lg"><FileText className="text-yellow-400" size={20} /></div><span className="text-sm xl:text-base font-medium drop-shadow-md">Digital Filing & Approvals</span></div>
            <div className="flex items-center text-white"><div className="bg-green-900/70 backdrop-blur-md border border-green-600/50 p-2 rounded-lg mr-4 shadow-lg"><Shield className="text-yellow-400" size={20} /></div><span className="text-sm xl:text-base font-medium drop-shadow-md">Encrypted System Access</span></div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-2/3 flex items-center justify-center p-8 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-100 relative overflow-hidden">
          
          <div className="lg:hidden text-center mb-8 flex flex-col items-center">
            <img src="/ptc-logo.png" alt="PTC Logo" className="w-20 h-20 object-contain mb-4" onError={(e) => e.target.style.display = 'none'} />
            <h2 className="text-2xl font-bold text-gray-800 font-serif">PTC Portal</h2>
          </div>

          {/* ── ALERTS ── */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start">
              <AlertCircle className="text-red-500 mr-3 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-md flex items-start">
              <Shield className="text-green-600 mr-3 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-green-800 font-medium">{successMsg}</p>
            </div>
          )}

          {/* ── STEP 1: EMAIL & PASSWORD ── */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
                <p className="text-sm text-gray-500 mt-2">Please enter your credentials to access your account.</p>
              </div>
              
              <form onSubmit={handleStepOneSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
                    <input 
                      type="email" required value={email} onChange={handleEmailChange} 
                      onKeyDown={handleEmailKeyDown} /* <-- ADDED onKeyDown EVENT */
                      disabled={isLoading}
                      className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none transition-all disabled:bg-gray-100 font-medium" 
                      placeholder="faculty@ptc.edu.ph" 
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest">Password</label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required value={password} onChange={handlePasswordChange} disabled={isLoading} 
                      ref={passwordInputRef} /* <-- ADDED REF HERE */
                      className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 outline-none transition-all disabled:bg-gray-100 font-medium" 
                      placeholder="••••••••" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors" tabIndex="-1">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                
                <button type="submit" disabled={isLoading || !email || !password} className="w-full bg-green-700 text-white py-3.5 rounded-xl hover:bg-green-800 font-bold transition-all shadow-md mt-6 flex justify-center items-center disabled:bg-green-400 disabled:cursor-not-allowed">
                  {isLoading ? <><Loader2 className="animate-spin mr-2" size={20} />Authenticating...</> : 'Continue'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 2: ENTER OTP ── */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Security Check</h2>
                <p className="text-sm text-gray-500 mt-2">Enter the 6-digit verification code sent to <span className="font-bold text-gray-800">{email}</span></p>
              </div>
              
              <form onSubmit={handleStepTwoSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">6-Digit OTP</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
                    <input 
                      type="text" required value={otpCode} onChange={handleOtpChange} disabled={isLoading} maxLength={6}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none transition-all disabled:bg-gray-100 font-bold tracking-[0.5em] text-center text-lg" 
                      placeholder="000000" 
                    />
                  </div>
                </div>
                
                <button type="submit" disabled={isLoading || otpCode.length !== 6} className="w-full bg-green-700 text-white py-3.5 rounded-xl hover:bg-green-800 font-bold transition-all shadow-md mt-6 flex justify-center items-center disabled:bg-green-400 disabled:cursor-not-allowed">
                  {isLoading ? <><Loader2 className="animate-spin mr-2" size={20} />Verifying...</> : 'Verify & Sign In'}
                </button>

                <button type="button" onClick={handleBackToLogin} disabled={isLoading} className="w-full text-gray-500 font-bold py-3 mt-2 hover:text-gray-800 transition-colors">
                  Back to Login
                </button>
              </form>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500 font-medium">
              Need access? Contact MIS: <a href="#" className="text-green-700 font-bold hover:underline">it.support@ptc.edu.ph</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}