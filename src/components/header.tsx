
"use client";

import { Bell, LogIn, Search, ShoppingCart, User, Home, UserPlus, ShoppingBag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Button } from './ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/context/auth-provider';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AuthForm from './auth-form';
import { useState, useEffect } from 'react';
import { getNotificationsForUser } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import type { Notification } from '@/lib/types';

export default function Header() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogDefaultTab, setAuthDialogDefaultTab] = useState<'login' | 'signup'>('login');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchNotifications = async () => {
        try {
          const notifications = await getNotificationsForUser(user.uid);
          const unread = notifications.filter(n => !n.isRead).length;
          setUnreadCount(unread);
        } catch (error) {
          console.error("Failed to fetch notifications for header count", error);
        }
      };
      
      // Fetch on mount
      fetchNotifications();

      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      
      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
    }
  }, [user]);


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-br from-sky-300 via-sky-100 to-white dark:from-sky-800 dark:via-sky-900 dark:to-black">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <div className="flex items-center gap-2">
            <SidebarTrigger className="relative h-8 w-8 bg-transparent text-foreground hover:bg-transparent/20" />
            <Link href="/">
              <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1 text-primary">
                    <span className="font-headline text-2xl font-bold">JASA</span>
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div className="flex w-full justify-between text-xs font-medium">
                    <span>E</span>
                    <span>S</span>
                    <span>S</span>
                    <span>E</span>
                    <span>N</span>
                    <span>T</span>
                    <span>I</span>
                    <span>A</span>
                    <span>L</span>
                  </div>
              </div>
            </Link>
        </div>

        <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
          <div className="flex items-center justify-end space-x-2">
              <Button asChild variant="ghost" size="icon" className={cn(
                'rounded-full h-9 w-9', 
                !isHomePage && 'border-2 border-transparent animate-border-pulse'
              )}>
                <Link href="/">
                    <Home className="h-5 w-5" />
                    <span className="sr-only">Home</span>
                </Link>
              </Button>
              {user && (
                <Button asChild variant="ghost" size="icon" className='relative rounded-full h-9 w-9'>
                    <Link href="/notifications">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0 bg-red-600 text-white hover:bg-red-700">
                                {unreadCount}
                            </Badge>
                        )}
                        <span className="sr-only">Notifications</span>
                    </Link>
                </Button>
              )}
              <Button asChild variant="outline" size={isMobile ? "icon" : "default"} className='rounded-full h-9 w-9 md:w-auto'>
                  <Link href="/cart">
                      <ShoppingCart className={isMobile ? "h-5 w-5" : "h-4 w-4"}/>
                      <span className="hidden md:inline">Cart</span>
                  </Link>
              </Button>
            {user ? (
                <Button asChild variant="outline" size={isMobile ? "icon" : "default"} className='rounded-full h-9 w-9 md:w-auto'>
                  <Link href="/profile">
                    <User className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    <span className="hidden md:inline">Profile</span>
                  </Link>
                </Button>
            ) : (
              <>
                <DialogTrigger asChild>
                  <Button 
                    size={isMobile ? "icon" : "default"} 
                    className='rounded-full h-9 w-9 md:w-auto' 
                    onClick={() => setAuthDialogDefaultTab('login')}>
                    <LogIn className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    <span className="hidden md:inline">Login</span>
                  </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                   <Button 
                    variant="secondary"
                    size={isMobile ? "icon" : "default"} 
                    className='rounded-full h-9 w-9 md:w-auto' 
                    onClick={() => setAuthDialogDefaultTab('signup')}>
                    <UserPlus className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    <span className="hidden md:inline">Sign Up</span>
                  </Button>
                </DialogTrigger>
              </>
            )}
          </div>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="sr-only">
                {authDialogDefaultTab === 'login' ? 'Login' : 'Sign Up'}
              </DialogTitle>
            </DialogHeader>
            <AuthForm defaultTab={authDialogDefaultTab} onSuccess={() => setIsAuthDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
