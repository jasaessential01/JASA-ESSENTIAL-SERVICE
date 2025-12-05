
"use client"

import { useState, useEffect } from "react"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-provider"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { usePathname, useRouter } from "next/navigation"
import { Sun, Settings, LogOut, UserPlus, LogIn, Home, ShoppingCart, User, Moon, ShieldCheck, Notebook, Book, Printer, CircuitBoard, FilePenLine, Store, Package, History, FolderKanban, ImageIcon, LayoutDashboard, Copy, UserCog, UserRoundCog, ClipboardList, Database, BookCopy, Map, PieChart, Wrench, Images } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Skeleton } from "./ui/skeleton"
import type { Shop } from "@/lib/types"
import Image from "next/image";
import AuthForm from "./auth-form";
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { getShops } from "@/lib/shops";

export default function AppSidebar() {
  const { user, loading } = useAuth()
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authDialogDefaultTab, setAuthDialogDefaultTab] = useState<'login' | 'signup'>('login');
  const { setOpenMobile } = useSidebar();
  
  const [userShops, setUserShops] = useState<Shop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(false);


  useEffect(() => {
    if (user && (user.roles.includes('seller') || user.roles.includes('employee'))) {
      const fetchUserShops = async () => {
        setIsLoadingShops(true);
        try {
          const allShops = await getShops();
          const assignedShops = allShops.filter(shop => 
            shop.ownerIds.includes(user.uid) || shop.employeeIds?.includes(user.uid)
          );
          setUserShops(assignedShops);
        } catch (error) {
          toast({ variant: "destructive", title: "Error", description: "Could not load your shops." });
        } finally {
          setIsLoadingShops(false);
        }
      };
      fetchUserShops();
    }
  }, [user, toast]);


  const handleMenuItemClick = () => {
    setOpenMobile(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: "There was a problem signing you out.",
      });
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  const handleCopyId = () => {
    if (user?.shortId) {
      navigator.clipboard.writeText(user.shortId);
      toast({
        title: "Copied to Clipboard",
        description: `User ID: ${user.shortId}`,
      });
    }
  };
  
  const renderUserShops = (role: 'seller' | 'employee') => {
    if (isLoadingShops) {
      return (
        <SidebarMenu>
          <SidebarMenuItem><Skeleton className="h-8 w-full" /></SidebarMenuItem>
          <SidebarMenuItem><Skeleton className="h-8 w-full" /></SidebarMenuItem>
        </SidebarMenu>
      );
    }

    if (userShops.length === 0) {
      return (
        <p className="px-2 text-xs text-sidebar-foreground/70">You are not assigned to any shops.</p>
      );
    }
    
    return (
       <SidebarMenu>
        {userShops.map(shop => (
          <SidebarMenuItem key={shop.id}>
             <SidebarMenuButton
                asChild
                onClick={handleMenuItemClick}
                isActive={pathname === `/seller/orders/${shop.id}`}
             >
                <Link href={`/seller/orders/${shop.id}`}>
                    <Store />
                    <span>{shop.name}</span>
                </Link>
             </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
       </SidebarMenu>
    );
  }

  const renderUserActions = () => {
    if (loading) {
      return (
        <div className="flex w-full justify-around">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      )
    }

    return (
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <SidebarMenu className="flex flex-row justify-around">
            <SidebarMenuItem>
                <SidebarMenuButton tooltip="Theme" size="icon" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun /> : <Moon />}
                </SidebarMenuButton>
            </SidebarMenuItem>
             {user ? (
                <>
                    <SidebarMenuItem>
                        <SidebarMenuButton tooltip="Settings" size="icon" asChild onClick={handleMenuItemClick}>
                            <Link href="/settings">
                                <Settings />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <SidebarMenuButton tooltip="Logout" size="icon">
                                <LogOut />
                            </SidebarMenuButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will sign you out of your account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSignOut}>Confirm</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </SidebarMenuItem>
                </>
             ) : (
                <>
                    <SidebarMenuItem>
                        <DialogTrigger asChild>
                           <SidebarMenuButton tooltip="Sign Up" size="icon" onClick={() => setAuthDialogDefaultTab('signup')}>
                              <UserPlus />
                          </SidebarMenuButton>
                        </DialogTrigger>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <DialogTrigger asChild>
                           <SidebarMenuButton tooltip="Login" size="icon" onClick={() => setAuthDialogDefaultTab('login')}>
                                <LogIn />
                            </SidebarMenuButton>
                        </DialogTrigger>
                    </SidebarMenuItem>
                </>
             )}
        </SidebarMenu>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">{authDialogDefaultTab === 'login' ? 'Login' : 'Sign Up'}</DialogTitle>
          </DialogHeader>
          <AuthForm defaultTab={authDialogDefaultTab} onSuccess={() => setIsAuthDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <SidebarContent className="p-2">
        <div className="flex items-center justify-center p-4 gap-2">
            <div className="relative h-10 w-10">
              <Image src="/favicon.ico" alt="Jasa Essential Logo" fill className="rounded-full border-2 border-black dark:border-white" />
            </div>
            <h2 className="font-headline text-xl font-bold text-sidebar-foreground">JASA ESSENTIAL</h2>
        </div>
        
        {user && (
           <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
              <SidebarMenu>
                <SidebarMenuItem>
                   <div className="flex flex-col items-start p-2 rounded-md border border-input h-auto w-full">
                      <span className="font-semibold text-base truncate">{user.displayName || user.name}</span>
                       {user.shortId && (
                         <div className="flex items-center gap-1">
                           <span className="text-xs text-muted-foreground">ID: <Badge variant="secondary" className="px-1">{user.shortId}</Badge></span>
                           <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopyId}>
                             <Copy className="h-3 w-3" />
                           </Button>
                         </div>
                       )}
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg p-2">
            {renderUserActions()}
        </SidebarGroup>
         <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname === '/'}>
                        <Link href="/">
                            <Home />
                            <span>Back to Home</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
            <SidebarGroupLabel>USER ACCESS</SidebarGroupLabel>
            <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/stationary')}>
                        <Link href="/stationary">
                            <Notebook />
                            <span>Stationary</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/books')}>
                        <Link href="/books">
                            <Book />
                            <span>Books</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/xerox')}>
                        <Link href="/xerox">
                            <Printer />
                            <span>Xerox</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/electronics')}>
                        <Link href="/electronics">
                            <CircuitBoard />
                            <span>Electronic Kit</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/cart')}>
                        <Link href="/cart">
                            <ShoppingCart />
                            <span>Cart</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/profile')}>
                        <Link href="/profile">
                            <User />
                            <span>Profile</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/orders')}>
                        <Link href="/orders">
                            <History />
                            <span>Track orders & History</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
        
        {user && Array.isArray(user.roles) && user.roles.includes('admin') && (
          <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
              <SidebarGroupLabel>ADMIN ACCESS</SidebarGroupLabel>
              <SidebarMenu>
                   <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/dashboard')}>
                          <Link href="/admin/dashboard">
                              <PieChart />
                              <span>Dashboard</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-users')}>
                          <Link href="/manage-users">
                              <UserCog />
                              <span>Manage Users</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-homepage')}>
                          <Link href="/manage-homepage">
                              <LayoutDashboard />
                              <span>Manage Homepage</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/order-settings')}>
                          <Link href="/admin/order-settings">
                              <Wrench />
                              <span>Order Settings</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/post-update')}>
                          <Link href="/post-update">
                              <FilePenLine />
                              <span>Post Update</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-shops')}>
                          <Link href="/manage-shops">
                              <Store />
                              <span>Manage Shops</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/manage-pincodes')}>
                          <Link href="/admin/manage-pincodes">
                              <Map />
                              <span>Manage Pincodes</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-products')}>
                          <Link href="/manage-products">
                              <Package />
                              <span>Manage Products</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/xerox-manage')}>
                          <Link href="/admin/xerox-manage">
                              <Copy />
                              <span>Manage Xerox List</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/xerox-form')}>
                          <Link href="/admin/xerox-form">
                              <ClipboardList />
                              <span>Manage Paper Types</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/manage-paper-samples')}>
                          <Link href="/admin/manage-paper-samples">
                              <Images />
                              <span>Paper Samples</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/xerox-options')}>
                          <Link href="/admin/xerox-options">
                              <BookCopy />
                              <span>Xerox Options</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-cloudinary')}>
                          <Link href="/manage-cloudinary">
                              <ImageIcon />
                              <span>Cloudinary</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/admin/manage-drive')}>
                          <Link href="/admin/manage-drive">
                              <Database />
                              <span>Manage Drive</span>
                          </Link>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
              </SidebarMenu>
          </SidebarGroup>
        )}
        
        {user && Array.isArray(user.roles) && user.roles.includes('seller') && (
            <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
              <SidebarGroupLabel>SELLER ACCESS</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/seller-dashboard')}>
                    <Link href="/seller-dashboard">
                      <FolderKanban />
                      <span>Seller Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              {renderUserShops('seller')}
            </SidebarGroup>
        )}

        {user && Array.isArray(user.roles) && user.roles.includes('employee') && (
            <SidebarGroup className="bg-gray-100 dark:bg-gray-900 rounded-lg">
              <SidebarGroupLabel>EMPLOYEE ACCESS</SidebarGroupLabel>
              <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/employee-dashboard')}>
                        <Link href="/employee-dashboard">
                            <LayoutDashboard />
                            <span>Dashboard</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                {user.canManageProducts && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleMenuItemClick} isActive={pathname.startsWith('/manage-products')}>
                      <Link href="/manage-products">
                        <Package />
                        <span>Manage Products</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
              {renderUserShops('employee')}
            </SidebarGroup>
        )}
    </SidebarContent>
  )
}
