import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const ref = searchParams.get('ref') || 'a friend';
  const invite = searchParams.get('invite') || '';
  const refId = searchParams.get('refId') || '';

  useEffect(() => {
    const target = new URLSearchParams({ mode: 'signup' });

    if (ref) target.set('ref', ref);
    if (invite) target.set('invite', invite);
    if (refId) target.set('refId', refId);

    navigate(`/auth?${target.toString()}`, { replace: true });
  }, [navigate, ref, invite, refId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-yellow-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-primary/20 shadow-elevated">
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-6xl">🥗</div>
          <h1 className="text-3xl font-bold text-foreground">Join Health-o-Meter</h1>
          <p className="text-muted-foreground">
            {ref} invited you to track meals, earn points, and climb the leaderboard.
          </p>
          <Button onClick={() => navigate(`/auth?mode=signup&ref=${encodeURIComponent(ref)}${invite ? `&invite=${encodeURIComponent(invite)}` : ''}${refId ? `&refId=${encodeURIComponent(refId)}` : ''}`)}>
            Create your account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}