

"use client";

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-provider';
import { useState, useEffect, useMemo } from 'react';
import { getOrdersBySeller, updateOrderStatus, approveOrderReturn, rejectOrderReturn, issueReplacement, getXeroxOptions } from '@/lib/data';
import { getAllUsers } from '@/lib/users';
import type { Order, UserProfile, OrderStatus, XeroxOption } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, User, Package, FileText, Phone, Truck, MapPin, Clock, CheckCircle, AlertTriangle, Undo2, Repeat, XCircle, Link as LinkIcon, FileWarning } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import OrderTracker from '@/components/order-tracker';
import { Badge } from '@/components/ui/badge';
import { HARDCODED_XEROX_OPTIONS } from '@/lib/xerox-options';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

type GroupedOrders = {
  [userId: string]: {
    user: UserProfile;
    orders: Order[];
  };
};

const NEXT_STATUS: Record<string, OrderStatus> = {
  "Processing": "Packed",
  "Packed": "Shipped",
  "Shipped": "Out for Delivery",
  "Out for Delivery": "Delivered",
  "Return Approved": "Out for Pickup",
  "Out for Pickup": "Picked Up",
  "Picked Up": "Return Completed",
};

const statusConfig: { [key in Order['status']]: { icon: React.ElementType, label: string, descriptiveLabel: string } } = {
  "Pending Confirmation": { icon: Phone, label: "Pending", descriptiveLabel: "Waiting for confirmation" },
  "Processing": { icon: Package, label: "Processing", descriptiveLabel: "Processing" },
  "Packed": { icon: Package, label: "Packed", descriptiveLabel: "Packed or Printed" },
  "Shipped": { icon: Truck, label: "Shipped", descriptiveLabel: "Shipping" },
  "Out for Delivery": { icon: Truck, label: "Out for Delivery", descriptiveLabel: "Out for Delivery" },
  "Delivered": { icon: CheckCircle, label: "Delivered", descriptiveLabel: "Delivered" },
  "Cancelled": { icon: XCircle, label: "Cancelled", descriptiveLabel: "Cancelled by User" },
  "Rejected": { icon: AlertTriangle, label: "Rejected", descriptiveLabel: "Rejected by Seller" },
  "Return Requested": { icon: Undo2, label: "Return Requested", descriptiveLabel: "Return Requested" },
  "Return Approved": { icon: CheckCircle, label: "Return Approved", descriptiveLabel: "Return Approved" },
  "Out for Pickup": { icon: Truck, label: "Out for Pickup", descriptiveLabel: "Out for Pickup" },
  "Picked Up": { icon: Package, label: "Picked Up", descriptiveLabel: "Picked Up" },
  "Return Rejected": { icon: XCircle, label: "Return Rejected", descriptiveLabel: "Return Rejected" },
  "Return Completed": { icon: CheckCircle, label: "Return Completed", descriptiveLabel: "Return Completed" },
  "Replacement Issued": { icon: Repeat, label: "Replacement Issued", descriptiveLabel: "Replacement Issued" },
};

const StatCard = ({ title, value, icon: Icon, loading }: { title: string, value: number, icon: React.ElementType, loading: boolean }) => (
    <Card className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
        <CardTitle className="text-xs font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {loading ? (
          <Skeleton className="h-6 w-10" />
        ) : (
          <div className="text-xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );

export default function ManageShopOrdersPage() {
  const params = useParams();
  const shopId = params.shopId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrders>({});
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectingReturn, setRejectingReturn] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const [paperTypes, setPaperTypes] = useState<XeroxOption[]>([]);
  const [bindingTypes, setBindingTypes] = useState<XeroxOption[]>([]);
  const [laminationTypes, setLaminationTypes] = useState<XeroxOption[]>([]);

  const isEmployeeOnly = user?.roles.includes('employee') && !user.roles.includes('seller');

  const fetchOrdersAndUsers = async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const [shopOrders, allUsers, fetchedPaperTypes, fetchedBindingTypes, fetchedLaminationTypes] = await Promise.all([
        getOrdersBySeller(shopId),
        getAllUsers(),
        getXeroxOptions('paperType'),
        getXeroxOptions('bindingType'),
        getXeroxOptions('laminationType'),
      ]);
      setOrders(shopOrders);

      setPaperTypes(fetchedPaperTypes);
      setBindingTypes(fetchedBindingTypes);
      setLaminationTypes(fetchedLaminationTypes);

      const usersMap = new Map(allUsers.map(u => [u.uid, u]));

      const grouped: GroupedOrders = shopOrders.reduce((acc, order) => {
        if (!acc[order.userId]) {
          const orderUser = usersMap.get(order.userId);
          if (orderUser) {
            acc[order.userId] = { user: orderUser, orders: [] };
          }
        }
        if (acc[order.userId]) {
          acc[order.userId].orders.push(order);
        }
        return acc;
      }, {} as GroupedOrders);

      setGroupedOrders(grouped);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || (!user.roles.includes("seller") && !user.roles.includes("employee"))) {
        router.push("/");
        return;
      }
      fetchOrdersAndUsers();
    }
  }, [authLoading, user, shopId, router, toast]);

  const handleConfirmOrder = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'Processing');
      toast({ title: 'Order Confirmed', description: 'The order is now being processed.' });
      fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleRejectOrder = async () => {
    if (!rejectingOrder || !rejectionReason.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'A reason for rejection is required.' });
        return;
    }
    try {
      await updateOrderStatus(rejectingOrder.id, 'Rejected', rejectionReason);
      toast({ title: 'Order Rejected', description: 'The customer has been notified.' });
      setRejectingOrder(null);
      setRejectionReason("");
      fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleRejectReturn = async () => {
    if (!rejectingReturn || !rejectionReason.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'A reason for rejection is required.' });
        return;
    }
    try {
        await rejectOrderReturn(rejectingReturn.id, rejectionReason);
        toast({ title: 'Return Rejected', description: 'The customer has been notified.' });
        setRejectingReturn(null);
        setRejectionReason("");
        fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
};


  const handleUpdateStatus = async (order: Order) => {
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;

    try {
      await updateOrderStatus(order.id, nextStatus);
      toast({ title: 'Status Updated', description: `Order is now: ${nextStatus}` });
      fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleApproveReturn = async (orderId: string) => {
    try {
      await approveOrderReturn(orderId);
      toast({ title: 'Return Approved', description: 'The return request has been approved.' });
      fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleIssueReplacement = async (orderId: string) => {
    try {
      await issueReplacement(orderId);
      toast({ title: 'Replacement Issued', description: 'The replacement has been marked as issued.' });
      fetchOrdersAndUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };


  const ordersByStatus = useMemo(() => {
    const pending: GroupedOrders = {};
    const active: GroupedOrders = {};
    const returns: GroupedOrders = {};
    const completed: GroupedOrders = {};

    Object.entries(groupedOrders).forEach(([userId, group]) => {
      const pendingOrders = group.orders.filter(o => o.status === 'Pending Confirmation');
      const activeOrders = group.orders.filter(o => ['Processing', 'Packed', 'Shipped', 'Out for Delivery'].includes(o.status));
      const returnOrders = group.orders.filter(o => o.status.startsWith('Return') || o.status === 'Picked Up' || o.status === 'Replacement Issued');
      const completedOrders = group.orders.filter(o => ['Delivered', 'Cancelled', 'Rejected', 'Return Completed'].includes(o.status));
      
      if (pendingOrders.length > 0) pending[userId] = { user: group.user, orders: pendingOrders };
      if (activeOrders.length > 0) active[userId] = { user: group.user, orders: activeOrders };
      if (returnOrders.length > 0) returns[userId] = { user: group.user, orders: returnOrders };
      if (completedOrders.length > 0) completed[userId] = { user: group.user, orders: completedOrders };
    });
    return { pending, active, returns, completed };
  }, [groupedOrders]);

  const orderStats = useMemo(() => {
    const activeStatuses = ["Pending Confirmation", "Processing", "Packed", "Shipped", "Out for Delivery"];
    return {
        active: orders.filter(o => activeStatuses.includes(o.status)).length,
        returns: orders.filter(o => o.status.startsWith('Return') || o.status === 'Picked Up' || o.status === 'Replacement Issued').length,
        completed: orders.filter(o => o.status === 'Delivered').length,
        sellerRejected: orders.filter(o => o.status === 'Rejected').length,
        userCancelled: orders.filter(o => o.status === 'Cancelled').length
    };
  }, [orders]);
  
  const getOptionName = (type: 'paperType' | 'colorOption' | 'formatType' | 'printRatio' | 'bindingType' | 'laminationType', id: string): string => {
    if (!id || id === 'none') return 'N/A';
    if (type === 'paperType') return paperTypes.find(o => o.id === id)?.name || id;
    if (type === 'bindingType') return bindingTypes.find(o => o.id === id)?.name || id;
    if (type === 'laminationType') return laminationTypes.find(o => o.id === id)?.name || id;
    if (type === 'colorOption') return HARDCODED_XEROX_OPTIONS.colorOptions.find(o => o.id === id)?.name || id;
    if (type === 'formatType') return HARDCODED_XEROX_OPTIONS.formatTypes.find(o => o.id === id)?.name || id;
    if (type === 'printRatio') return HARDCODED_XEROX_OPTIONS.printRatios.find(o => o.id === id)?.name || id;
    return id;
};


  const renderOrderList = (filteredGroupedOrders: GroupedOrders, listType: 'pending' | 'active' | 'returns' | 'completed') => {
    if (isLoading) {
      return (
         <div className="mt-8 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
         </div>
      );
    }

    const orderGroups = Object.values(filteredGroupedOrders);

    if (orderGroups.length === 0) {
      return (
        <Card className="mt-8 text-center py-12">
            <CardHeader>
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle>No orders in this category</CardTitle>
                <CardDescription>There are currently no orders with this status.</CardDescription>
            </CardHeader>
        </Card>
      );
    }
    
    return (
        <div className="mt-8 space-y-6">
          {orderGroups.map(({ user, orders }) => {
            const firstOrder = orders[0];
            if (!firstOrder) return null;
            const address = firstOrder.shippingAddress;
            return (
              <Card key={user.uid}>
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center gap-2">
                      <User /> Customer: {user.name}
                  </CardTitle>
                  <CardDescription>Email: {user.email}</CardDescription>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
                      <Phone className="h-4 w-4" />
                      <div>
                          <p>{orders[0].mobile}</p>
                          {orders[0].altMobiles?.[0]?.value && <p>{orders[0].altMobiles[0].value}</p>}
                      </div>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-start gap-2 pt-2 border-t mt-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-foreground">{address.type} Address</p>
                        <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
                        <p>{address.city}, {address.state} - {address.postalCode}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {orders.map(order => {
                    const isXerox = order.category === 'xerox';
                    const xeroxConfig = order.xeroxConfig;
                    
                    const isReplacement = order.returnType === 'replacement';
                    const baseStatusInfo = statusConfig[order.status];
                    let StatusIcon = baseStatusInfo?.icon || Package;
                    let descriptiveStatus = baseStatusInfo?.descriptiveLabel || order.status;

                    if (isReplacement && ['Return Approved', 'Replacement Issued', 'Shipped', 'Delivered'].includes(order.status)) {
                        StatusIcon = Repeat; // Use replacement icon
                        if (order.status !== 'Return Requested') {
                           descriptiveStatus = `Replacement: ${baseStatusInfo.descriptiveLabel}`;
                        }
                    }

                    const itemPrice = order.price || 0;
                    const deliveryCharge = order.deliveryCharge || 0;
                    const itemQuantity = order.quantity || 1;
                    const totalItemPrice = (itemPrice * itemQuantity) + deliveryCharge;
                    
                    let details: { label: string; value: string | number }[] = [];
                    if (isXerox && xeroxConfig) {
                        details = [
                           { label: 'Paper', value: getOptionName('paperType', xeroxConfig.paperType) },
                           { label: 'Color', value: getOptionName('colorOption', xeroxConfig.colorOption) },
                           { label: 'Format', value: getOptionName('formatType', xeroxConfig.formatType) },
                           { label: 'Ratio', value: getOptionName('printRatio', xeroxConfig.printRatio) },
                           { label: 'Binding', value: getOptionName('bindingType', xeroxConfig.bindingType) },
                           { label: 'Lamination', value: getOptionName('laminationType', xeroxConfig.laminationType) },
                           { label: 'Instructions', value: xeroxConfig.message },
                        ].filter(d => d.value && d.value !== 'N/A');
                    }

                    return (
                      <div key={order.id} className="p-4 border rounded-lg flex flex-col gap-4">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="relative h-16 w-16 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                    {order.productImage ? (
                                        <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                                    ) : (
                                        <FileText className="h-8 w-8 text-muted-foreground m-auto" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-semibold">{order.productName}</p>
                                    <p className="text-sm text-muted-foreground">Quantity: {itemQuantity}</p>
                                    <p className="text-sm text-muted-foreground">Price: Rs {itemPrice.toFixed(2)}</p>
                                    {deliveryCharge > 0 && <p className="text-sm text-muted-foreground">Delivery: Rs {deliveryCharge.toFixed(2)}</p>}
                                    <p className="text-sm font-semibold">Total: Rs {totalItemPrice.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 self-end md:self-start">
                              <Badge variant={order.status === 'Rejected' || order.status === 'Cancelled' ? 'destructive' : 'default'} className="flex items-center gap-2">
                                  <StatusIcon className="h-4 w-4" />
                                  {descriptiveStatus}
                              </Badge>
                              {listType === 'pending' && !isEmployeeOnly && (
                                  <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleConfirmOrder(order.id)}>
                                          <Check className="mr-2 h-4 w-4"/> Confirm
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setRejectingOrder(order)}>
                                          <X className="mr-2 h-4 w-4"/> Reject
                                      </Button>
                                  </div>
                                )}
                            </div>
                          </div>
                           {isXerox ? (
                                order.productImage ? (
                                    <Button variant="outline" asChild className="w-full sm:w-auto">
                                        <a href={order.productImage} target="_blank" rel="noopener noreferrer">
                                            <LinkIcon className="mr-2 h-4 w-4"/> View Document
                                        </a>
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-destructive p-2 border border-destructive/50 rounded-md">
                                        <FileWarning className="h-5 w-5" />
                                        <p>User has not uploaded document.</p>
                                    </div>
                                )
                            ) : null}
                          {isXerox && details.length > 0 && (
                            <Card className="bg-muted/50">
                                <CardHeader className="p-2">
                                    <CardTitle className="text-sm">Print Configuration</CardTitle>
                                </CardHeader>
                                <CardContent className="p-2">
                                    <Table>
                                        <TableBody>
                                        {details.map(detail => (
                                            <TableRow key={detail.label} className="border-0">
                                                <TableCell className="p-1 text-xs text-muted-foreground">{detail.label}</TableCell>
                                                <TableCell className="p-1 text-xs font-medium">{detail.value}</TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                          )}
                           {order.status === 'Return Requested' && (
                                <>
                                <Separator />
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Return Reason ({order.returnType}):</h4>
                                    <p className="text-sm text-muted-foreground p-2 border rounded-md">{order.returnReason}</p>
                                     {!isEmployeeOnly && (
                                        <div className="flex gap-2 justify-end">
                                        {order.returnType === 'replacement' && (
                                            <Button size="sm" variant="outline" onClick={() => handleIssueReplacement(order.id)}>Issue Replacement</Button>
                                        )}
                                            <Button size="sm" variant="outline" onClick={() => handleApproveReturn(order.id)}>Approve Return</Button>
                                            <Button size="sm" variant="destructive" onClick={() => setRejectingReturn(order)}>Reject Return</Button>
                                        </div>
                                     )}
                                </div>
                                </>
                           )}
                          {listType !== 'pending' && (
                            <>
                            <Separator />
                            <OrderTracker trackingInfo={order.tracking} />
                            {listType === 'active' && !order.status.startsWith('Return') && (
                              <CardFooter className="p-0">
                                  <Button 
                                    className="w-full" 
                                    onClick={() => handleUpdateStatus(order)} 
                                    disabled={!NEXT_STATUS[order.status] || (isEmployeeOnly && order.status === 'Processing')}
                                  >
                                    {NEXT_STATUS[order.status] ? `Update to: ${NEXT_STATUS[order.status]}` : "Order Complete"}
                                  </Button>
                              </CardFooter>
                            )}
                            {listType === 'returns' && order.status !== 'Return Requested' && order.status !== 'Return Rejected' && (
                                <CardFooter className="p-0">
                                    <Button className="w-full" onClick={() => handleUpdateStatus(order)} disabled={!NEXT_STATUS[order.status]}>
                                        {NEXT_STATUS[order.status] ? `Update to: ${NEXT_STATUS[order.status]}` : "Return Finished"}
                                    </Button>
                                </CardFooter>
                            )}
                            </>
                          )}
                      </div>
                  )})}
                </CardContent>
              </Card>
            )
          })}
        </div>
    )
  }

  return (
    <>
    <Dialog open={!!rejectingOrder} onOpenChange={(open) => {if (!open) setRejectingOrder(null)}}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Order: {rejectingOrder?.productName}</DialogTitle>
                <DialogDescription>
                    Please provide a reason for rejecting this order. This will be shown to the customer.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Textarea 
                    placeholder="e.g., Item is out of stock, Unable to deliver to the provided address, etc."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                />
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setRejectingOrder(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleRejectOrder}>Confirm Rejection</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={!!rejectingReturn} onOpenChange={(open) => { if (!open) setRejectingReturn(null) }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Return: {rejectingReturn?.productName}</DialogTitle>
                <DialogDescription>Please provide a reason for rejecting this return request. This will be shown to the customer.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Textarea
                    placeholder="e.g., Item was damaged by customer, return period expired, etc."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                />
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setRejectingReturn(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleRejectReturn}>Confirm Rejection</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <div className="container mx-auto px-4 py-8">
      <div className="pb-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">
          Manage Shop Orders
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review and process incoming orders for your shop.
        </p>
      </div>
      
      <div className="sticky top-[80px] z-40 bg-background py-2 space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatCard title="Active" value={orderStats.active} icon={Clock} loading={isLoading} />
            <StatCard title="Returns" value={orderStats.returns} icon={Undo2} loading={isLoading} />
            <StatCard title="Completed" value={orderStats.completed} icon={CheckCircle} loading={isLoading} />
            <StatCard title="Rejected" value={orderStats.sellerRejected} icon={AlertTriangle} loading={isLoading} />
            <StatCard title="Cancelled" value={orderStats.userCancelled} icon={X} loading={isLoading} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pending ({Object.values(ordersByStatus.pending).reduce((sum, group) => sum + group.orders.length, 0)})</TabsTrigger>
              <TabsTrigger value="active">Active ({Object.values(ordersByStatus.active).reduce((sum, group) => sum + group.orders.length, 0)})</TabsTrigger>
              <TabsTrigger value="returns">Returns ({Object.values(ordersByStatus.returns).reduce((sum, group) => sum + group.orders.length, 0)})</TabsTrigger>
              <TabsTrigger value="completed">History ({Object.values(ordersByStatus.completed).reduce((sum, group) => sum + group.orders.length, 0) + orders.filter(o => o.status === 'Return Completed').length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="pending" className="mt-0">
            {renderOrderList(ordersByStatus.pending, 'pending')}
          </TabsContent>
          <TabsContent value="active" className="mt-0">
            {renderOrderList(ordersByStatus.active, 'active')}
          </TabsContent>
          <TabsContent value="returns" className="mt-0">
            {renderOrderList(ordersByStatus.returns, 'returns')}
          </TabsContent>
          <TabsContent value="completed" className="mt-0">
            {renderOrderList(ordersByStatus.completed, 'completed')}
          </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
