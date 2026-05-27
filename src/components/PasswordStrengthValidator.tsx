import React, { useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface PasswordStrengthValidatorProps {
  password: string;
  onValidityChange?: (isValid: boolean) => void;
}

export function PasswordStrengthValidator({
  password,
  onValidityChange,
}: PasswordStrengthValidatorProps) {
  const criteria = useMemo(() => {
    return [
      {
        id: 'length',
        label: 'At least 8 characters',
        test: (pw: string) => pw.length >= 8,
      },
      {
        id: 'uppercase',
        label: 'One uppercase letter',
        test: (pw: string) => /[A-Z]/.test(pw),
      },
      {
        id: 'number',
        label: 'One numeric digit',
        test: (pw: string) => /[0-9]/.test(pw),
      },
      {
        id: 'special',
        label: 'One special character (!@#$%^&*)',
        test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw),
      },
    ];
  }, []);

  const results = useMemo(() => {
    return criteria.map((c) => ({
      ...c,
      passed: c.test(password),
    }));
  }, [password, criteria]);

  const passedCount = useMemo(() => {
    return results.filter((r) => r.passed).count ?? results.filter((r) => r.passed).length;
  }, [results]);

  // Firebase has a minimum requirement of 6 characters.
  // Let's decide if password is valid (e.g., minimum 6 characters to allow submission,
  // or we can require all strength criteria to make it extremely secure!).
  // Let's require at least 6 characters and at least 3 criteria for validity, or simply:
  // Let's make it fully valid for registration/override if length is at least 6.
  // But let's export isValid = password.length >= 6.
  const isValid = useMemo(() => {
    return password.length >= 6;
  }, [password]);

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  const strengthLabel = useMemo(() => {
    if (!password) return 'Empty';
    if (passedCount <= 1) return 'Weak';
    if (passedCount <= 3) return 'Medium';
    return 'Strong';
  }, [password, passedCount]);

  const strengthColor = useMemo(() => {
    if (!password) return 'bg-slate-200 dark:bg-slate-800';
    if (passedCount <= 1) return 'bg-rose-500';
    if (passedCount <= 3) return 'bg-amber-500';
    return 'bg-emerald-500';
  }, [password, passedCount]);

  const strengthTextColor = useMemo(() => {
    if (!password) return 'text-slate-400';
    if (passedCount <= 1) return 'text-rose-500';
    if (passedCount <= 3) return 'text-amber-500';
    return 'text-emerald-500';
  }, [password, passedCount]);

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-3 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-3 shadow-inner"
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
          Password Strength Check
        </span>
        <span className={cn("text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800", strengthTextColor)}>
          {strengthLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", strengthColor)}
          style={{ width: `${(passedCount / criteria.length) * 100}%` }}
        />
      </div>

      {/* Criteria list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
        {results.map((res) => (
          <div key={res.id} className="flex items-center gap-1.5">
            <span className={cn(
              "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full transition-colors",
              res.passed 
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" 
                : "bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-600"
            )}>
              {res.passed ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : (
                <X className="w-2.5 h-2.5 stroke-[3]" />
              )}
            </span>
            <span className={cn(
              "text-[10px] font-medium leading-none transition-colors",
              res.passed ? "text-slate-700 dark:text-slate-300 font-semibold" : "text-slate-400 dark:text-slate-500"
            )}>
              {res.label}
            </span>
          </div>
        ))}
      </div>

      {/* Special minimum requirement disclaimer */}
      {password.length < 6 && (
        <p className="text-[9px] text-rose-500 font-bold tracking-wide">
          * At least 6 characters total is required for system login setup.
        </p>
      )}
    </motion.div>
  );
}
