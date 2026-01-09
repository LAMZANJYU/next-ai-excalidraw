'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">应用程序错误</CardTitle>
          <CardDescription>
            遇到了意外错误。您可以尝试刷新页面或重试。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {error.message || '未知错误'}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
            >
              返回首页
            </Button>
            <Button onClick={reset}>重试</Button>
          </div>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-4">
              错误ID: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
