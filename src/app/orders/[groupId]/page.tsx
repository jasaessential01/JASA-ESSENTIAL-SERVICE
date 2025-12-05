
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-provider";
import { getOrdersByGroupId } from "@/lib/data";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, ShoppingCart, Package } from "lucide-react";
import Image from "next/image";
import OrderTracker from "@/components/order-tracker";
import { Badge } from "@/components/ui/badge";

export default function OrderGroupDetailPage() {
  const { groupId } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    if (typeof groupId !== 'string') {
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid Order Group ID.' });
      router.push('/orders');
      return;
    }

    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const fetchedOrders = await getOrdersByGroupId(groupId);
        if (fetchedOrders.length === 0 || fetchedOrders[0].userId !== user.uid) {
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
    fetchOrders();
  }, [groupId, user, authLoading, router, toast]);

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
                     <Badge variant={order.status.includes('Delivered') ? 'default' : 'secondary'}>{order.status}</Badge>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
