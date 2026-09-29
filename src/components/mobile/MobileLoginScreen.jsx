import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, User, Info, AlertCircle } from 'lucide-react';
import OrcaLogo from '../OrcaLogo';
import { TRANSLATIONS } from '../../utils/translations';

export default function MobileLoginScreen({
  currentRole = 'fisherman',
  onLoginSuccess,
  onBack,
  language = 'en',
  onSwitchLanguage,
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const [username, setUsername] = useState('mariner_maharashtra');
  const [password, setPassword] = useState('orca2026');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Field validation and interactive states
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  // Role metadata
  const roleMeta = {
    fisherman: {
      name: t.roleFisherman,
      badge: language === 'mr' ? 'मच्छीमार पोर्टल' : language === 'hi' ? 'मछुआरा पोर्टल' : 'Fisherman Portal',
      badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
      btnGradient: 'from-teal-600 to-sky-700 hover:from-teal-500 hover:to-sky-600',
    },
    coast_guard: {
      name: t.roleCoastGuard,
      badge: language === 'mr' ? 'तटरक्षक दल कमांड' : language === 'hi' ? 'तटरक्षक बल कमांड' : 'Coast Guard Command',
      badgeColor: 'text-sky-800 bg-sky-50 border-sky-200',
      btnGradient: 'from-sky-700 to-indigo-800 hover:from-sky-600 hover:to-indigo-700',
    },
    researcher: {
      name: t.roleResearcher,
      badge: language === 'mr' ? 'सागरी संशोधक पोर्टल' : language === 'hi' ? 'शोधकर्ता पोर्टल' : 'Researcher Telemetry',
      badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      btnGradient: 'from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600',
    },
  };

  const currentRoleInfo = roleMeta[currentRole] || roleMeta.fisherman;

  const validate = () => {
    const errs = {};
    if (!username || !username.trim()) {
      errs.username = t.errEmptyUsername || 'Please enter your username.';
    }
    if (!password || !password.trim()) {
      errs.password = t.errEmptyPassword || 'Please enter your password.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    setStatusNotice(null);

    if (!validate()) return;

    setIsLoading(true);

    // Realistic client-side local session initialization (honest prototype flow)
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        username: username.trim(),
        role: currentRole,
        isGuest: false,
        rememberMe,
      });
    }, 450);
  };

  const handleGuestContinue = () => {
    setStatusNotice(null);
    onLoginSuccess({
      username: 'guest_mariner',
      role: currentRole,
      isGuest: true,
      rememberMe: false,
    });
  };

  const handleForgotPassword = () => {
    // Honest handling of unsupported backend recovery
    setStatusNotice({
      type: 'info',
      message: t.errPasswordRecoveryUnavailable || 'Password recovery is not available yet in this prototype.',
    });
  };

  const handleGoogleSignIn = () => {
    // Honest handling of unsupported Google OAuth
    setStatusNotice({
      type: 'warning',
      message: t.errGoogleAuthUnavailable || 'Google Sign-In is not configured in this prototype environment.',
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 bg-slate-50 text-slate-800 select-none overflow-y-auto font-sans">
      {/* Top Navigation & Language Header */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-200/60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backButton || 'Back'}</span>
        </button>

        {/* Quick Language Toggle on Login Screen */}
        {onSwitchLanguage && (
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            {['en', 'hi', 'mr'].map((langKey) => (
              <button
                key={langKey}
                type="button"
                onClick={() => onSwitchLanguage(langKey)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  language === langKey
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {langKey === 'mr' ? 'मराठी' : langKey === 'hi' ? 'हिंदी' : 'EN'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Card Container */}
      <div className="my-auto py-2 space-y-4 max-w-sm w-full mx-auto">
        {/* Brand Header with Official ORCA Logo */}
        <div className="text-center space-y-1.5">
          <div className="inline-block transition-transform hover:scale-105">
            <OrcaLogo size="lg" variant="original" className="shadow-md rounded-full" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {t.welcomeToOrca || 'Welcome to ORCA'}
          </h2>
          
          {/* Selected Role Indicator Banner */}
          <div className="inline-flex items-center gap-2 pt-0.5">
            <span className="text-xs text-slate-500 font-medium">
              {t.signInRoleSubtitle || 'Sign in to access'}:
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentRoleInfo.badgeColor}`}>
              {currentRoleInfo.name}
            </span>
          </div>
        </div>

        {/* Status / Unsupported Feature Notice Banner */}
        {statusNotice && (
          <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusNotice.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">
              <span>{statusNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Prototype Transparency Notice */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200/80 text-[11.5px] text-slate-600 leading-relaxed shadow-2xs">
          <div className="flex items-center gap-1.5 text-sky-800 font-bold text-xs mb-0.5">
            <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>ORCA Local Session</span>
          </div>
          {t.prototypeNotice || 'Prototype Session: Real-time marine calculations active without remote password storage.'}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSignIn} className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3.5">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.usernameLabel || 'Username or Maritime ID'}:
            </label>
            <div className={`relative flex items-center bg-slate-50 border rounded-xl px-3 py-2.5 transition-all ${
              errors.username
                ? 'border-red-400 bg-red-50/30'
                : 'border-slate-200 focus-within:border-sky-600 focus-within:bg-white'
            }`}>
              <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: null }));
                }}
                placeholder={t.usernamePlaceholder || 'Enter your username or ID'}
                className="w-full bg-transparent text-xs text-slate-900 font-medium outline-none placeholder:text-slate-400"
                autoComplete="username"
              />
            </div>
            {errors.username && (
              <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.username}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.passwordLabel || 'Password'}:
            </label>
            <div className={`relative flex items-center bg-slate-50 border rounded-xl px-3 py-2.5 transition-all ${
              errors.password
                ? 'border-red-400 bg-red-50/30'
                : 'border-slate-200 focus-within:border-sky-600 focus-within:bg-white'
            }`}>
              <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
                placeholder={t.passwordPlaceholder || 'Enter your password'}
                className="w-full bg-transparent text-xs text-slate-900 font-medium outline-none placeholder:text-slate-400"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.password}</span>
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-800">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-sky-700 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span className="text-[11.5px] font-medium">{t.rememberMe || 'Remember me'}</span>
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sky-700 hover:text-sky-900 hover:underline text-[11.5px] font-bold cursor-pointer"
            >
              {t.forgotPassword || 'Forgot password?'}
            </button>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 bg-gradient-to-r ${currentRoleInfo.btnGradient} text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-sky-800/15 transition-all active:scale-[0.98] text-xs sm:text-sm cursor-pointer mt-1 disabled:opacity-75`}
          >
            {isLoading ? (
              <span>{t.loggingIn || 'Signing in...'}</span>
            ) : (
              <>
                <span>{t.loginButton || 'Login'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* OR Divider */}
        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-slate-50 px-3 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">
            {t.orDivider || 'OR'}
          </span>
          <div className="border-t border-slate-200 w-full" />
        </div>

        {/* Continue with Google Button (Honest unsupported handling) */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-3 bg-white hover:bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2.5 transition-all shadow-2xs cursor-pointer active:scale-[0.99]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>{t.continueWithGoogle || 'Continue with Google'}</span>
        </button>
      </div>

      {/* Bottom Guest Option */}
      <div className="pt-2 pb-2 text-center">
        <button
          onClick={handleGuestContinue}
          type="button"
          className="text-xs text-slate-500 hover:text-sky-700 underline font-semibold cursor-pointer"
        >
          {t.continueAsGuest || 'Continue as Guest (Direct Access)'}
        </button>
      </div>
    </div>
  );
}
