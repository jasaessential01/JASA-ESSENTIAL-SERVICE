
"use client";

import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-provider';
import { updateUserProfile } from '@/lib/users';
import { getShops } from '@/lib/shops';
import { getOrderSettings, createOrder, getXeroxOptions } from '@/lib/data';
import { useState, useEffect, useMemo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Store, Info, MapPin, ArrowLeft, Loader2, CheckCircle, FileText, Trash2, Link as LinkIcon } from 'lucide-react';
import type { UserProfile, Shop, OrderSettings, ShopService, XeroxOption, Address } from '@/lib/types';
import { HARDCODED_XEROX_OPTIONS } from '@/lib/xerox-options';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { v4 as uuidv4 } from 'uuid';

type StoredXeroxJob = {
    id: string;
    fileDetails: { name: string; type: string; url: string; };
    pageCount: number;
    price: number;
    config: {
        paperType: string;
        colorOption: string;
        formatType: string;
        printRatio: string;
        bindingType: string;
        laminationType: string;
        quantity: number;
        message: string;
    };
};

const addressSchema = z.object({
  type: z.enum(['Home', 'Work']),
  line1: z.string().min(1, "Address Line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal Code is required"),
});

const mobileSchema = z.object({
    mobile: z.string().regex(/^\d{10}$/, "A valid 10-digit mobile number is required."),
    altMobiles: z.array(z.object({ value: z.string().min(10, "Alternate number must be 10 digits.") })).min(1, "At least one alternate mobile number is required."),
});

const checkoutFormSchema = z.object({
  selectedAddress: z.string().min(1, "Please select a shipping address."),
  selectedShop: z.string().min(1, "Please select a seller."),
});

export default function XeroxCheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [xeroxJobs, setXeroxJobs] = useState<StoredXeroxJob[]>([]);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [orderSettings, setOrderSettings] = useState<OrderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  
  const [paperTypes, setPaperTypes] = useState<XeroxOption[]>([]);
  const [bindingTypes, setBindingTypes] = useState<XeroxOption[]>([]);
  const [laminationTypes, setLaminationTypes] = useState<XeroxOption[]>([]);

  const checkoutForm = useForm<z.infer<typeof checkoutFormSchema>>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { selectedAddress: "", selectedShop: "" },
  });
  
  const mobileForm = useForm<z.infer<typeof mobileSchema>>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { 
        mobile: user?.mobile || '',
        altMobiles: user?.altMobiles?.length ? user.altMobiles.map(alt => ({ value: alt.value || '' })) : [{ value: ''}],
    }
  });

  const { fields: altMobilesFields, append: appendAltMobile, remove: removeAltMobile } = useFieldArray({
    control: mobileForm.control,
    name: "altMobiles",
  });

  const addressForm = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: { type: 'Home', line1: '', line2: '', city: '', state: '', postalCode: '' }
  });

  useEffect(() => {
    const storedJobs = sessionStorage.getItem('xeroxCheckoutJobs');
    if (storedJobs) {
      const parsedJobs = JSON.parse(storedJobs);
      if (parsedJobs.length > 0) {
        setXeroxJobs(parsedJobs);
      } else {
        toast({ variant: 'destructive', title: 'No documents to checkout.', description: 'Redirecting to Xerox page.' });
        router.push('/xerox');
      }
    } else {
      toast({ variant: 'destructive', title: 'No documents to checkout.', description: 'Redirecting to Xerox page.' });
      router.push('/xerox');
    }

    if (!authLoading && !user) router.push('/login');
    
    if (user) {
        if (user.addresses && user.addresses.length > 0 && !checkoutForm.getValues('selectedAddress')) {
            checkoutForm.setValue('selectedAddress', `address-0`);
        }
        mobileForm.reset({ 
            mobile: user.mobile || '',
            altMobiles: user.altMobiles?.length ? user.altMobiles.map(alt => ({ value: alt.value || '' })) : [{ value: '' }],
        });
    }
    
    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [shops, settings, papers, bindings, laminations] = await Promise.all([
                getShops(), 
                getOrderSettings(),
                getXeroxOptions('paperType'),
                getXeroxOptions('bindingType'),
                getXeroxOptions('laminationType'),
            ]);
            setAllShops(shops);
            setOrderSettings(settings);
            setPaperTypes(papers);
            setBindingTypes(bindings);
            setLaminationTypes(laminations);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch checkout data." });
        } finally {
            setLoading(false);
        }
    };
    fetchInitialData();
  }, [user, authLoading, router, checkoutForm, toast, mobileForm]);
  
  const calculatePriceDetails = useCallback((job: StoredXeroxJob) => {
    const paperType = paperTypes.find(p => p.id === job.config.paperType);
    const colorOption = HARDCODED_XEROX_OPTIONS.colorOptions.find(o => o.id === job.config.colorOption);
    const formatType = HARDCODED_XEROX_OPTIONS.formatTypes.find(o => o.id === job.config.formatType);
    const printRatio = HARDCODED_XEROX_OPTIONS.printRatios.find(o => o.id === job.config.printRatio);
    const bindingType = bindingTypes.find(o => o.id === job.config.bindingType);
    const laminationType = laminationTypes.find(o => o.id === job.config.laminationType);

    if (!paperType) return { pricePerPage: 0, bindingCost: 0, laminationCost: 0, finalPrice: 0 };
    
    const basePricePerPage = colorOption?.name === 'Gradient / Colour' ? paperType.priceColor ?? 0 : paperType.priceBw ?? 0;
    const pricePerPage = printRatio?.name === '1:2 (Two pages per sheet)' ? basePricePerPage / 2 : basePricePerPage;

    const documentPages = job.pageCount;
    const physicalPages = formatType?.name === 'Front and Back' ? Math.ceil(documentPages / 2) : documentPages;
    const printingCost = physicalPages * pricePerPage;

    const bindingCost = bindingType?.price || 0;
    const laminationCost = laminationType?.price || 0;
    const singleCopyPrice = printingCost + bindingCost + laminationCost;
    const finalPrice = singleCopyPrice * job.config.quantity;
    
    return { pricePerPage, bindingCost, laminationCost, finalPrice };
  }, [paperTypes, bindingTypes, laminationTypes]);

  const { xeroxSubtotal, xeroxDeliveryFee, total } = useMemo(() => {
    if (!orderSettings) return { xeroxSubtotal: 0, xeroxDeliveryFee: 0, total: 0 };
    
    const subtotal = xeroxJobs.reduce((acc, job) => {
        const { finalPrice } = calculatePriceDetails(job);
        return acc + finalPrice;
    }, 0);
    
    let deliveryFee = 0;
    if (subtotal > 0 && subtotal < orderSettings.minXeroxOrderPrice) {
        deliveryFee = orderSettings.xeroxDeliveryCharge;
    }
    
    return { xeroxSubtotal: subtotal, xeroxDeliveryFee: deliveryFee, total: subtotal + deliveryFee };
  }, [xeroxJobs, orderSettings, calculatePriceDetails]);
  

  async function onAddressSubmit(values: z.infer<typeof addressSchema>) {
    if (!user) return;
    try {
      const newAddresses = [...(user.addresses || []), values];
      await updateUserProfile(user.uid, { addresses: newAddresses });
      toast({ title: "Address Saved", description: "Your new address has been added." });
      addressForm.reset();
      setIsAddressDialogOpen(false);
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error", description: `Failed to save address: ${error.message}` });
    }
  }

  async function onCheckoutSubmit(values: z.infer<typeof checkoutFormSchema>) {
    const mobileData = mobileForm.getValues();
    const isValid = await mobileForm.trigger();
    if (!isValid) {
       toast({ variant: 'destructive', title: 'Invalid Mobile Number', description: 'Please check your mobile numbers. At least one alternate number is required.' });
       return;
    }

    if (!user || !user.addresses || !orderSettings) return;

    setIsPlacingOrder(true);
    const addressIndex = parseInt(values.selectedAddress.replace('address-', ''));
    const shippingAddress = user.addresses[addressIndex];
    
    await updateUserProfile(user.uid, { mobile: mobileData.mobile, altMobiles: mobileData.altMobiles?.filter(m => m.value) });

    const groupId = uuidv4();
    const orderPromises = xeroxJobs.map(job => {
        return createOrder({
            groupId,
            userId: user.uid,
            productName: job.fileDetails.name,
            productImage: job.fileDetails.url,
            quantity: job.config.quantity,
            price: job.price,
            deliveryCharge: xeroxDeliveryFee / xeroxJobs.length,
            sellerId: values.selectedShop,
            shippingAddress: shippingAddress,
            mobile: mobileData.mobile,
            altMobiles: mobileData.altMobiles?.filter(m => m.value),
            status: 'Pending Confirmation',
            category: 'xerox',
            xeroxConfig: job.config,
        });
    });

    try {
        await Promise.all(orderPromises);
        sessionStorage.removeItem('xeroxCheckoutJobs');
        setOrderPlaced(true);
        setTimeout(() => { router.push('/orders'); }, 5000);
    } catch(e: any) {
        toast({ variant: "destructive", title: 'Order Creation Failed', description: `An error occurred: ${e.message}` });
    } finally {
        setIsPlacingOrder(false);
    }
  }
  
  if (authLoading || loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }
  
  const selectedAddress = checkoutForm.watch('selectedAddress');

  const renderAddressSelection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">1. Select Shipping Address</CardTitle>
      </CardHeader>
      <CardContent>
        {(!user?.addresses || user.addresses.length === 0) ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">You have no saved addresses. Please add one to continue.</p>
              <Button onClick={() => setIsAddressDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Address</Button>
            </div>
        ) : (
            <>
            <FormField
              control={checkoutForm.control}
              name="selectedAddress"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user.addresses.map((address, index) => (
                        <FormItem key={index} className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl><RadioGroupItem value={`address-${index}`} className="mt-1" /></FormControl>
                            <FormLabel className="font-normal w-full">
                                <p className="font-bold text-base">{address.type} Address</p>
                                <Table className="mt-2 text-sm">
                                  <TableBody>
                                    <TableRow className="border-0"><TableCell className="p-1 w-20 text-muted-foreground">Line 1:</TableCell><TableCell className="p-1">{address.line1}</TableCell></TableRow>
                                    {address.line2 && <TableRow className="border-0"><TableCell className="p-1 w-20 text-muted-foreground">Line 2:</TableCell><TableCell className="p-1">{address.line2}</TableCell></TableRow>}
                                    <TableRow className="border-0"><TableCell className="p-1 w-20 text-muted-foreground">City:</TableCell><TableCell className="p-1">{address.city}</TableCell></TableRow>
                                    <TableRow className="border-0"><TableCell className="p-1 w-20 text-muted-foreground">State:</TableCell><TableCell className="p-1">{address.state}</TableCell></TableRow>
                                    <TableRow className="border-0"><TableCell className="p-1 w-20 text-muted-foreground">Pincode:</TableCell><TableCell className="p-1">{address.postalCode}</TableCell></TableRow>
                                  </TableBody>
                                </Table>
                            </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button variant="outline" onClick={() => setIsAddressDialogOpen(true)} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Another Address</Button>
            </>
        )}
      </CardContent>
    </Card>
  );

  const renderMobileSection = () => {
    if (!selectedAddress) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">2. Contact Information</CardTitle>
          <CardDescription>
            Confirm your mobile number for delivery updates. At least one alternate number is required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...mobileForm}>
            <div className="space-y-4">
              <FormField
                control={mobileForm.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Mobile Number</FormLabel>
                    <FormControl><Input {...field} type="tel" placeholder="10-digit mobile number" prefix="+91" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {altMobilesFields.map((field, index) => (
                 <FormField
                    key={field.id}
                    control={mobileForm.control}
                    name={`altMobiles.${index}.value`}
                    render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                        <FormControl><Input {...field} value={field.value || ''} type="tel" placeholder={`Alt. Mobile ${index + 1}`} prefix="+91" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeAltMobile(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </FormItem>
                    )}
                />
              ))}
              {altMobilesFields.length < 2 && (
                <Button type="button" variant="outline" size="sm" onClick={() => appendAltMobile({ value: '' })}><PlusCircle className="mr-2 h-4 w-4" /> Add Alternate</Button>
              )}
               <FormField control={mobileForm.control} name="altMobiles" render={({ field }) => <FormMessage {...field} />} />
            </div>
          </Form>
        </CardContent>
      </Card>
    );
  };
  
  const renderSellerSelection = () => {
    if (!selectedAddress) return null;
    const availableShops = allShops.filter(shop => shop.services.includes('xerox' as ShopService));
    if (availableShops.length === 0) return <p className="text-muted-foreground">Sorry, no sellers provide Xerox services.</p>;
    return (
      <Card>
        <CardHeader><CardTitle className="font-headline">3. Select a Seller</CardTitle></CardHeader>
        <CardContent>
          <FormField control={checkoutForm.control} name="selectedShop" render={({ field }) => (
            <FormItem><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableShops.map((shop) => (
                <FormItem key={shop.id} className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><RadioGroupItem value={shop.id} className="mt-1" /></FormControl>
                    <FormLabel className="font-normal w-full">
                        <p className="font-bold flex items-center gap-2"><Store className="h-4 w-4" /> {shop.name}</p>
                        <p className="text-sm text-muted-foreground">{shop.address}</p>
                        {shop.notes && <p className="text-sm mt-2 pt-2 border-t">{shop.notes}</p>}
                        {shop.locations && shop.locations.length > 0 && (<div className="text-sm mt-2 pt-2 border-t">
                            <p className="font-medium flex items-center gap-1"><MapPin className="h-4 w-4" /> Available in:</p>
                            <ul className="list-disc pl-5 text-muted-foreground">{shop.locations.map((loc, i) => <li key={i}>{loc}</li>)}</ul>
                        </div>)}
                    </FormLabel>
                </FormItem>
              ))}
            </RadioGroup></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
      </Card>
    );
  }

  const renderAddressForm = () => (
    <Form {...addressForm}>
        <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-4">
            <FormField control={addressForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Address Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select address type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Home">Home</SelectItem><SelectItem value="Work">Work</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={addressForm.control} name="line1" render={({ field }) => (<FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} placeholder="123 Main St" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={addressForm.control} name="line2" render={({ field }) => (<FormItem><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input {...field} placeholder="Apartment, suite, etc." /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField control={addressForm.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addressForm.control} name="state" render={({ field }) => (<FormItem><FormLabel>State / Province</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={addressForm.control} name="postalCode" render={({ field }) => (<FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={addressForm.formState.isSubmitting}>{addressForm.formState.isSubmitting ? "Saving..." : "Save Address"}</Button></DialogFooter>
        </form>
    </Form>
  )
  
  const getOptionName = (type: 'paperType' | 'colorOption' | 'formatType' | 'printRatio' | 'bindingType' | 'laminationType', id: string): string => {
      if (!id || id === 'none') return '';
      if (type === 'paperType') return paperTypes.find(o => o.id === id)?.name || '';
      if (type === 'colorOption') return HARDCODED_XEROX_OPTIONS.colorOptions.find(o => o.id === id)?.name || '';
      if (type === 'formatType') return HARDCODED_XEROX_OPTIONS.formatTypes.find(o => o.id === id)?.name || '';
      if (type === 'printRatio') return HARDCODED_XEROX_OPTIONS.printRatios.find(o => o.id === id)?.name || '';
      if (type === 'bindingType') return bindingTypes.find(o => o.id === id)?.name || '';
      if (type === 'laminationType') return laminationTypes.find(o => o.id === id)?.name || '';
      return '';
  };
  
  const isCheckoutDisabled = isPlacingOrder || !checkoutForm.formState.isValid;

  return (
    <>
      <Dialog open={orderPlaced}>
        <DialogContent hideCloseButton>
            <DialogHeader><DialogTitle className="sr-only">Order Placed</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold">Order Placed Successfully!</h2>
                <p className="text-muted-foreground mt-2">Your print order has been placed. You will be redirected to your order history shortly.</p>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add New Address</DialogTitle></DialogHeader>{renderAddressForm()}</DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">Xerox Checkout</h1>
          <Button variant="outline" asChild>
            <Link href="/xerox"><ArrowLeft className="mr-2 h-4 w-4" />Back to Xerox</Link>
          </Button>
        </div>
        <Form {...checkoutForm}>
          <form onSubmit={checkoutForm.handleSubmit(onCheckoutSubmit)} className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
                {renderAddressSelection()}
                {renderMobileSection()}
                {renderSellerSelection()}
            </div>
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader><CardTitle className="font-headline">Final Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {xeroxJobs.map((job, index) => {
                        const { finalPrice } = calculatePriceDetails(job);
                        return (<div key={job.id} className="flex justify-between items-center text-sm"><span className="truncate pr-4">Doc {index + 1}: {job.fileDetails.name}</span><span>Rs {finalPrice.toFixed(2)}</span></div>);
                    })}
                    <Separator />
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Subtotal</span><span>Rs {xeroxSubtotal.toFixed(2)}</span></div>
                        {xeroxDeliveryFee > 0 && <div className="flex justify-between text-destructive"><span>Delivery</span><span>Rs {xeroxDeliveryFee.toFixed(2)}</span></div>}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>Rs {total.toFixed(2)}</span></div>
                    </div>
                    {orderSettings && xeroxSubtotal > 0 && xeroxSubtotal < orderSettings.minXeroxOrderPrice && (
                      <Alert className="mt-2"><Info className="h-4 w-4" /><AlertTitle>Delivery Charge Applied</AlertTitle><AlertDescription>Your printing subtotal is below Rs {orderSettings.minXeroxOrderPrice}. A fee of Rs {orderSettings.xeroxDeliveryCharge} has been added.</AlertDescription></Alert>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isCheckoutDisabled}>{isPlacingOrder ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing Order...</> : "Place Order"}</Button>
                </CardFooter>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
