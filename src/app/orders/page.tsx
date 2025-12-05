
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-provider";
import { useRouter } from "next/navigation";
import { getMyOrders, updateOrderStatus, requestReturn } from "@/lib/data";
import type { Order, Shop } from "@/lib/types";
import { getShops } from "@/lib/shops";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format } from 'date-fns';

type GroupedOrders = {
    [groupId: string]: {
        orders: Order[];
        createdAt: any;
        sellerId: string;
    }
}

export default function OrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [shops, setShops] = useState<Shop[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
                return;
            }
            const fetchInitialData = async () => {
                setIsLoading(true);
                try {
                    const [fetchedOrders, fetchedShops] = await Promise.all([
                        getMyOrders(user.uid),
                        getShops()
                    ]);
                    setOrders(fetchedOrders);
                    setShops(fetchedShops);
                } catch (error: any) {
                    toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch data: ${error.message}` });
                } finally {
                    setIsLoading(false);
                }
            }
            fetchInitialData();
        }
    }, [user, authLoading, router, toast]);

    const groupedOrders = useMemo((): GroupedOrders => {
        if (!orders) return {};
        return orders.reduce((acc, order) => {
            const groupId = order.groupId;
            if (!acc[groupId]) {
                acc[groupId] = {
                    orders: [],
                    createdAt: order.createdAt,
                    sellerId: order.sellerId, // Assuming all orders in a group have the same seller
                };
            }
            acc[groupId].orders.push(order);
            return acc;
        }, {} as GroupedOrders);
    }, [orders]);
    
    const sortedGroupIds = useMemo(() => {
        return Object.keys(groupedOrders).sort((a, b) => {
            return (groupedOrders[b].createdAt?.seconds || 0) - (groupedOrders[a].createdAt?.seconds || 0);
        });
    }, [groupedOrders]);

    const getShopForOrderGroup = (sellerId: string) => {
        return shops.find(shop => shop.id === sellerId);
    };

    if (authLoading || isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">Order Status & History</h1>
                <p className="mt-2 text-muted-foreground">Loading your order history...</p>
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-64 w-full" />
                    ))}
                </div>
            </div>
        )
    }

    if (orders.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <ShoppingCart className="mx-auto h-24 w-24 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">No Orders Found</h2>
                <p className="text-muted-foreground">You haven't placed any orders yet.</p>
                <Button asChild className="mt-6">
                    <Link href="/">Start Shopping</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">Order Status & History</h1>
            <p className="mt-2 text-muted-foreground">Here are the orders you've placed.</p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
                {sortedGroupIds.map(groupId => {
                    const group = groupedOrders[groupId];
                    const firstOrder = group.orders[0];
                    const shop = getShopForOrderGroup(firstOrder.sellerId);

                    const total = group.orders.reduce((sum, order) => sum + (order.price * order.quantity + order.deliveryCharge), 0);
                    const subtotal = group.orders.reduce((sum, order) => sum + order.price * order.quantity, 0);
                    const totalDelivery = group.orders.reduce((sum, order) => sum + order.deliveryCharge, 0);

                    return (
                        <Card key={groupId}>
                            <CardHeader>
                                <CardTitle className="break-words">Ordered on {format(firstOrder.createdAt.toDate(), 'PPP, p')}</CardTitle>
                                <CardDescription>Group ID: {groupId}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    {group.orders.map(order => (
                                        <div key={order.id} className="flex justify-between items-start gap-4">
                                            <p className="flex-grow truncate">{order.productName}</p>
                                            <p className="flex-shrink-0">x{order.quantity}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t space-y-1 text-sm">
                                    <div className="flex justify-between font-medium"><p>Subtotal:</p> <p>Rs {subtotal.toFixed(2)}</p></div>
                                    <div className="flex justify-between font-medium"><p>Delivery:</p> <p>Rs {totalDelivery.toFixed(2)}</p></div>
                                    <div className="flex justify-between font-bold text-base"><p>Total:</p> <p>Rs {total.toFixed(2)}</p></div>
                                </div>
                                {shop && (
                                    <div className="mt-4 pt-4 border-t text-sm">
                                        <h4 className="font-semibold mb-1">Seller Information</h4>
                                        <p className="font-medium">{shop.name}</p>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Phone className="h-4 w-4" />
                                            <span>{shop.mobileNumbers?.join(', ')}</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href={`/orders/${groupId}`}>View Details & Status</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
