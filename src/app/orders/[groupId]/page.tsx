
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-provider";
import { getOrdersByGroupId, cancelOrder } from "@/lib/data";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, ShoppingCart, Package, XCircle } from "lucide-react";
import Image from "next/image";
import OrderTracker from "@/components/order-tracker";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";


export default function OrderGroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = async () => {
      if (typeof groupId !== 'string') {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid Order Group ID.' });
        router.push('/orders');
        return;
      }
      setIsLoading(true);
      try {
        const fetchedOrders = await getOrdersByGroupId(groupId);
        if (fetchedOrders.length === 0 || fetchedOrders[0].userId !== user?.uid) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view these orders.' });
            router.push('/orders');
            return;
        }
        setOrders(fetchedOrders);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch order details: ${error.message}` });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchOrders();
  }, [groupId, user, authLoading, router, toast]);

  const handleCancelOrder = async () => {
    if (!cancellingOrder || !cancelReason.trim()) {
        toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason for cancellation.' });
        return;
    }
    setIsSubmitting(true);
    try {
        await cancelOrder(cancellingOrder.id, cancelReason);
        toast({ title: 'Order Cancelled', description: 'Your order has been successfully cancelled.' });
        setCancellingOrder(null);
        setCancelReason("");
        fetchOrders(); // Re-fetch orders to show updated status
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Cancellation Failed', description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-32 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
    <AlertDialog open={!!cancellingOrder} onOpenChange={(open) => { if (!open) setCancellingOrder(null) }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Cancel Order: {cancellingOrder?.productName}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Please provide a reason for cancelling this item. This cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="cancel-reason">Reason for Cancellation</Label>
                <Textarea 
                    id="cancel-reason"
                    placeholder="e.g., Ordered by mistake, no longer needed..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Keep Order</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelOrder} disabled={isSubmitting}>
                    {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <div className="container mx-auto px-4 py-8">
      <Button variant="outline" onClick={() => router.push('/orders')} className="mb-8">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to All Orders
      </Button>

      <h1 className="font-headline text-2xl font-bold tracking-tight lg:text-3xl mb-2">
        Order Details
      </h1>
      <p className="text-sm text-muted-foreground mb-8">Group ID: {groupId}</p>

      <div className="space-y-6">
        {orders.map(order => (
          <Card key={order.id}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="line-clamp-2">{order.productName}</CardTitle>
                        <CardDescription>Order ID: {order.id}</CardDescription>
                    </div>
                     <Badge variant={order.status.includes('Delivered') ? 'default' : (order.status.includes('Cancelled') || order.status.includes('Rejected')) ? 'destructive' : 'secondary'}>
                        {order.status === 'Cancelled' ? 'Cancelled by You' : order.status}
                     </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-start gap-4">
                     <div className="relative h-24 w-24 flex-shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                        {order.category === 'xerox' ? (
                            <FileText className="h-12 w-12 text-blue-500" />
                        ) : order.productImage ? (
                            <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                        ) : (
                            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-grow space-y-1 text-sm">
                        <p><span className="font-medium">Quantity:</span> {order.quantity}</p>
                        <p><span className="font-medium">Price per item:</span> Rs {order.price.toFixed(2)}</p>
                        <p><span className="font-medium">Total:</span> Rs {(order.price * order.quantity).toFixed(2)}</p>
                    </div>
                </div>
                <div className="mt-4">
                    <OrderTracker trackingInfo={order.tracking} />
                </div>
            </CardContent>
            {order.status === 'Pending Confirmation' && (
                <CardFooter>
                    <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setCancellingOrder(order)}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Item
                    </Button>
                </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
    </>
  );
}
