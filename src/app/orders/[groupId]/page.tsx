

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-provider";
import { getOrdersByGroupId, cancelOrder, getXeroxOptions, updateOrderWithDocumentUrl } from "@/lib/data";
import type { Order, XeroxOption } from "@/lib/types";
import { HARDCODED_XEROX_OPTIONS } from "@/lib/xerox-options";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, ShoppingCart, Package, XCircle, Link as LinkIcon, Info, UploadCloud, Loader2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

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
  
  const [uploadingFileForOrder, setUploadingFileForOrder] = useState<Order | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paperTypes, setPaperTypes] = useState<XeroxOption[]>([]);
  const [bindingTypes, setBindingTypes] = useState<XeroxOption[]>([]);
  const [laminationTypes, setLaminationTypes] = useState<XeroxOption[]>([]);

  const fetchOrdersAndOptions = useCallback(async () => {
      if (typeof groupId !== 'string') {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid Order Group ID.' });
        router.push('/orders');
        return;
      }
      setIsLoading(true);
      try {
        const [fetchedOrders, fetchedPaperTypes, fetchedBindingTypes, fetchedLaminationTypes] = await Promise.all([
            getOrdersByGroupId(groupId),
            getXeroxOptions('paperType'),
            getXeroxOptions('bindingType'),
            getXeroxOptions('laminationType'),
        ]);

        if (fetchedOrders.length > 0 && fetchedOrders[0].userId !== user?.uid) {
            toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view these orders.' });
            router.push('/orders');
            return;
        }
        setOrders(fetchedOrders);
        setPaperTypes(fetchedPaperTypes);
        setBindingTypes(fetchedBindingTypes);
        setLaminationTypes(fetchedLaminationTypes);

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to fetch order details: ${error.message}` });
      } finally {
        setIsLoading(false);
      }
    }, [groupId, user?.uid, toast, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchOrdersAndOptions();
  }, [groupId, user, authLoading, router, toast, fetchOrdersAndOptions]);

  const getPageCount = async (file: File): Promise<number | undefined> => {
      try {
          const arrayBuffer = await file.arrayBuffer();
          if (file.type === 'application/pdf') {
              const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
              return pdf.numPages;
          } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              const result = await mammoth.extractRawText({ arrayBuffer });
              const wordCount = result.value.split(/\s+/).filter(Boolean).length;
              return Math.ceil(wordCount / 250);
          }
           return 1;
      } catch (error) {
          console.error("Error getting page count:", error);
          toast({ variant: 'destructive', title: 'Error', description: `Could not parse page count for ${file.name}.` });
          return undefined;
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadingFileForOrder) return;
    
    const file = e.target.files[0];
    const originalConfig = uploadingFileForOrder.xeroxConfig;
    const originalFileDetails = {
        name: uploadingFileForOrder.productName,
        pages: originalConfig?.pageCount,
    };

    if (file.name !== originalFileDetails.name) {
        toast({
            variant: "destructive",
            title: "File Mismatch",
            description: `Please upload the original file named "${originalFileDetails.name}".`,
        });
        return;
    }
    
    setIsUploading(true);

    const newPageCount = await getPageCount(file);
    if (newPageCount !== originalFileDetails.pages) {
        toast({
            variant: "destructive",
            title: "Page Count Mismatch",
            description: `The uploaded file has ${newPageCount} pages, but the original order was for ${originalFileDetails.pages} pages. Please upload the correct file.`,
            duration: 9000
        });
        setIsUploading(false);
        return;
    }

    try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        
        if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
        
        await updateOrderWithDocumentUrl(uploadingFileForOrder.id, data.url);

        toast({ title: "Upload Successful", description: "Your document has been linked to the order." });
        setUploadingFileForOrder(null);
        fetchOrdersAndOptions(); // Refresh data
    } catch (err: any) {
        toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    } finally {
        setIsUploading(false);
    }
  };


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
  
  const getOptionPrice = (type: 'bindingType' | 'laminationType', id: string): number => {
    if (type === 'bindingType') return bindingTypes.find(o => o.id === id)?.price || 0;
    if (type === 'laminationType') return laminationTypes.find(o => o.id === id)?.price || 0;
    return 0;
  }

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
        fetchOrdersAndOptions(); // Re-fetch orders to show updated status
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
      
      <Input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <h1 className="font-headline text-2xl font-bold tracking-tight lg:text-3xl mb-2">
        Order Details
      </h1>
      <p className="text-sm text-muted-foreground mb-8">Group ID: {groupId}</p>

      <div className="space-y-6">
        {orders.map(order => {
          const isXerox = order.category === 'xerox';
          const xeroxConfig = order.xeroxConfig;
          
          let bindingCost = 0;
          let laminationCost = 0;
          let details: { label: string; value: string | number }[] = [];

          if (isXerox && xeroxConfig) {
             bindingCost = getOptionPrice('bindingType', xeroxConfig.bindingType);
             laminationCost = getOptionPrice('laminationType', xeroxConfig.laminationType);
             details = [
                { label: 'Paper', value: getOptionName('paperType', xeroxConfig.paperType) },
                { label: 'Color', value: getOptionName('colorOption', xeroxConfig.colorOption) },
                { label: 'Format', value: getOptionName('formatType', xeroxConfig.formatType) },
                { label: 'Pages', value: xeroxConfig.pageCount },
                { label: 'Ratio', value: getOptionName('printRatio', xeroxConfig.printRatio) },
                { label: 'Binding', value: getOptionName('bindingType', xeroxConfig.bindingType) },
                { label: 'Lamination', value: getOptionName('laminationType', xeroxConfig.laminationType) },
                { label: 'Instructions', value: xeroxConfig.message },
             ].filter(d => d.value && d.value !== 'N/A');
          }
          
          return (
          <Card key={order.id}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="line-clamp-2">{order.productName}</CardTitle>
                        <CardDescription>Order ID: {order.id}</CardDescription>
                    </div>
                     <Badge variant={order.status === 'Cancelled' ? 'destructive' : (order.status.includes('Rejected') ? 'destructive' : 'secondary')}>
                        {order.status === 'Cancelled' ? 'Cancelled by You' : order.status}
                     </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                     <div className="relative h-24 w-24 flex-shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                        {isXerox ? (
                            <FileText className="h-12 w-12 text-blue-500" />
                        ) : order.productImage ? (
                            <Image src={order.productImage} alt={order.productName} fill className="object-cover" />
                        ) : (
                            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-grow space-y-2">
                        <div className="text-sm">
                            <p><span className="font-medium">Quantity:</span> {order.quantity}</p>
                            <p><span className="font-medium">Price per item:</span> Rs {order.price.toFixed(2)}</p>
                            <p><span className="font-medium">Total:</span> Rs {(order.price * order.quantity).toFixed(2)}</p>
                        </div>
                        {isXerox && (
                          <div className="pt-2">
                          {order.productImage ? (
                            <Button variant="outline" asChild className="w-full sm:w-auto">
                                <a href={order.productImage} target="_blank" rel="noopener noreferrer">
                                  <LinkIcon className="mr-2 h-4 w-4"/> View Uploaded Document
                                </a>
                            </Button>
                          ) : (
                             <Button 
                                variant="secondary" 
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  setUploadingFileForOrder(order);
                                  fileInputRef.current?.click();
                                }}
                                disabled={isUploading}
                              >
                                {isUploading && uploadingFileForOrder?.id === order.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                )}
                                Upload Document
                             </Button>
                          )}
                          </div>
                        )}
                    </div>
                </div>

                {isXerox && xeroxConfig && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Printing & Finishing Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        <div className="space-y-2">
                           <h4 className="font-semibold text-sm">Configuration</h4>
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
                        </div>
                         <div className="space-y-2">
                           <h4 className="font-semibold text-sm">Price Estimation</h4>
                           <Table>
                              <TableBody>
                                {bindingCost > 0 && (
                                  <TableRow className="border-0">
                                    <TableCell className="p-1 text-xs text-muted-foreground">Binding Cost</TableCell>
                                    <TableCell className="p-1 text-xs font-medium text-right">Rs {bindingCost.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {laminationCost > 0 && (
                                  <TableRow className="border-0">
                                    <TableCell className="p-1 text-xs text-muted-foreground">Lamination Cost</TableCell>
                                    <TableCell className="p-1 text-xs font-medium text-right">Rs {laminationCost.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                 <TableRow className="border-0">
                                    <TableCell className="p-1 text-xs text-muted-foreground">Printing Cost</TableCell>
                                    <TableCell className="p-1 text-xs font-medium text-right">Rs {(order.price - bindingCost - laminationCost).toFixed(2)}</TableCell>
                                  </TableRow>
                                <TableRow className="border-t">
                                    <TableCell className="p-1 font-bold text-sm">Total per Item</TableCell>
                                    <TableCell className="p-1 font-bold text-sm text-right">Rs {order.price.toFixed(2)}</TableCell>
                                  </TableRow>
                              </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                  </Card>
                )}

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
        )})}
      </div>
    </div>
    </>
  );
}


