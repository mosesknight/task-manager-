import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckSquare, ArrowLeft, RotateCcw } from 'lucide-react';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string = (location.state as { email?: string })?.email ?? '';

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect back if no email in state
  useEffect(() => {
    if (!email) navigate('/forgot-password', { replace: true });
  }, [email, navigate]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const code = digits.join('');

  const handleChange = (index: number, value: string) => {
    // Accept paste of full code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const next = Array(CODE_LENGTH).fill('');
      pasted.split('').forEach((c, i) => { next[i] = c; });
      setDigits(next);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (code.length < CODE_LENGTH) {
      toast.error('Please enter the full 6-digit code');
      return;
    }
    setIsVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setIsVerifying(false);

    if (error) {
      toast.error(error.message || 'Invalid or expired code');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      return;
    }

    toast.success('Code verified — set your new password');
    navigate('/reset-password', { state: { verified: true } });
  };

  const handleResend = async () => {
    setIsResending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setIsResending(false);

    if (error) {
      toast.error(error.message || 'Failed to resend code');
      return;
    }

    setDigits(Array(CODE_LENGTH).fill(''));
    setCountdown(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
    toast.success('New code sent — check your inbox');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <CheckSquare className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold">Enter verification code</CardTitle>
          <CardDescription>
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* OTP digit inputs */}
          <div className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="h-12 w-10 text-center text-lg font-semibold px-0"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <Button
            className="w-full"
            disabled={isVerifying || code.length < CODE_LENGTH}
            onClick={handleVerify}
          >
            {isVerifying ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
            ) : (
              'Verify code'
            )}
          </Button>

          {/* Resend */}
          <div className="text-center text-sm text-muted-foreground">
            {countdown > 0 ? (
              <span>Resend code in {countdown}s</span>
            ) : (
              <button
                type="button"
                disabled={isResending}
                onClick={handleResend}
                className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline disabled:opacity-50"
              >
                {isResending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
                  : <><RotateCcw className="h-3.5 w-3.5" />Resend code</>}
              </button>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-center pb-6">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />Change email
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
