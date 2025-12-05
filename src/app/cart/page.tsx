
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingBag, Plus, Minus, Info, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Product, OrderSettings, CartItem, XeroxDocument } from "@/lib/types";
import { useAuth } from "@/context/auth-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AuthForm from "@/components/auth-form";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getOrderSettings } from "@/lib/data";

const categories: { value: string, label: string }[] = [
    { value: 'all', label: 'All Items' },
    { value: 'stationary', label: 'Stationary' },
    { value: 'books', label: 'Books' },
    { value: 'electronics', label: 'Electronic Kit' },
    { value: 'xerox', label: 'Xerox & Printing' },
];

export default function CartPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { items, removeItem, updateQuantity, setSelectedItems, selectedItems } = useCart();
  const [activeTab, setActiveTab] = useState('all');
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [orderSettings, setOrderSettings] = useState<OrderSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        const settings = await getOrderSettings();
        setOrderSettings(settings);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load order settings.",
        });
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [toast, isClient]);


  const handleToggleSelectedItem = (itemId: string) => {
    const newSelectedItems = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    setSelectedItems(newSelectedItems);
  };
  
  const handleToggleAll = (itemsToToggle: CartItem[]) => {
      const itemIds = itemsToToggle.map(item => item.id);
      const allSelected = itemIds.every(id => selectedItems.includes(id));
      if (allSelected) {
          setSelectedItems(selectedItems.filter(id => !itemIds.includes(id)));
      } else {
          setSelectedItems([...new Set([...selectedItems, ...itemIds])]);
      }
  }

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return; // Prevent quantity from going below 1
    updateQuantity(itemId, newQuantity);
  };

  const getCategoryItems = (category: string) => {
    if (category === 'all') return items;
    return items.filter(item => item.type === category);
  };

  const selectedCartItems = useMemo(() => {
    return items.filter(item => selectedItems.includes(item.id));
  }, [items, selectedItems]);

  const handleCheckout = () => {
    if (selectedCartItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Items Selected',
        description: 'Please select items to check out.',
      });
      return;
    }
    router.push('/checkout');
  };

  if (!isClient) {
    // Render a skeleton or loading state on the server to avoid hydration mismatch
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">Your Cart</h1>
        </div>
    );
  }

  if (items.length === 0) {
    return (
      <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <div className="container mx-auto px-4 py-8 text-center">
          <ShoppingBag className="mx-auto h-24 w-24 text-muted-foreground" />
          <h1 className="mt-4 font-headline text-3xl font-bold">Your Cart is Empty</h1>
          {user ? (
            <>
              <p className="mt-2 text-muted-foreground">Looks like you haven't added anything to your cart yet.</p>
              <Button asChild className="mt-6">
                <Link href="/">Start Shopping</Link>
              </Button>
            </>
          ) : (
             <>
              <p className="mt-2 text-muted-foreground">Please log in to add items to your cart.</p>
                <DialogTrigger asChild>
                  <Button className="mt-6">Login to Shop</Button>
                </DialogTrigger>
             </>
          )}
        </div>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">Authentication</DialogTitle>
          </DialogHeader>
          <AuthForm onSuccess={() => setIsAuthDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }
  
  const renderOrderSummary = () => {
    if (loadingSettings) {
      return (
        <Card>
          <CardHeader><CardTitle className="font-headline">Order Summary</CardTitle></CardHeader>
          <CardContent><p>Loading summary...</p></CardContent>
        </Card>
      );
    }
    if (selectedCartItems.length === 0) return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-center text-muted-foreground">Select items to see the summary and proceed to checkout.</p>
            </CardContent>
        </Card>
    );

    const { total, itemsSubtotal, xeroxSubtotal, deliveryFee, savings, xeroxDeliveryFee } = (() => {
        const productItems = selectedCartItems.filter(item => item.type !== 'xerox') as (CartItem & {type: 'stationary' | 'books' | 'electronics', product: Product})[];
        const xeroxItems = selectedCartItems.filter(item => item.type === 'xerox') as (CartItem & {type: 'xerox', xerox: XeroxDocument})[];
        
        const itemsSubtotal = productItems.reduce((acc, item) => acc + (item.product.discountPrice || item.product.price) * item.quantity, 0);
        
        const originalItemsTotal = productItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
        const savings = originalItemsTotal - itemsSubtotal;

        let deliveryFee = 0;
        if (orderSettings && productItems.length > 0 && itemsSubtotal < orderSettings.minItemOrderForFreeDelivery) {
            deliveryFee = orderSettings.itemDeliveryCharge || 0;
        }

        const xeroxSubtotal = xeroxItems.reduce((acc, item) => acc + item.price, 0);
        let xeroxDeliveryFee = 0;
        if (orderSettings && xeroxItems.length > 0 && xeroxSubtotal < orderSettings.minXeroxOrderPrice) {
            xeroxDeliveryFee = orderSettings.xeroxDeliveryCharge;
        }

        const total = itemsSubtotal + deliveryFee + xeroxSubtotal + xeroxDeliveryFee;
        return { total, itemsSubtotal, xeroxSubtotal, deliveryFee, savings, xeroxDeliveryFee };
    })();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {selectedCartItems.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                  <span className="truncate pr-4">{item.type === 'xerox' ? item.xerox.file?.name : item.product.name}</span>
                  <span className="flex-shrink-0">{item.quantity} x Rs {(item.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
             {itemsSubtotal > 0 && <div className="flex justify-between"><span>Items Subtotal</span><span>Rs {itemsSubtotal.toFixed(2)}</span></div>}
             {xeroxSubtotal > 0 && <div className="flex justify-between"><span>Printing Subtotal</span><span>Rs {xeroxSubtotal.toFixed(2)}</span></div>}
             {deliveryFee > 0 && <div className="flex justify-between text-destructive"><span>Item Delivery</span><span>Rs {deliveryFee.toFixed(2)}</span></div>}
             {xeroxDeliveryFee > 0 && <div className="flex justify-between text-destructive"><span>Printing Delivery</span><span>Rs {xeroxDeliveryFee.toFixed(2)}</span></div>}
             {savings > 0 && <div className="flex justify-between text-green-600"><span>You Save on Items</span><span>Rs {savings.toFixed(2)}</span></div>}
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>

          {orderSettings && itemsSubtotal > 0 && itemsSubtotal < orderSettings.minItemOrderForFreeDelivery && (
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Almost there!</AlertTitle>
                <AlertDescription>
                    Add items worth Rs {(orderSettings.minItemOrderForFreeDelivery - itemsSubtotal).toFixed(2)} more for FREE delivery on products.
                </AlertDescription>
            </Alert>
          )}

          {orderSettings && xeroxSubtotal > 0 && xeroxSubtotal < orderSettings.minXeroxOrderPrice && (
            <Alert className="mt-2">
                <Info className="h-4 w-4" />
                <AlertTitle>Printing Delivery Charge</AlertTitle>
                <AlertDescription>
                    Your printing subtotal is below Rs {orderSettings.minXeroxOrderPrice}. A fee of Rs {orderSettings.xeroxDeliveryCharge} has been added.
                </AlertDescription>
            </Alert>
          )}

        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleCheckout}>
            Proceed to Checkout ({selectedCartItems.length} items)
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const categoryItems = getCategoryItems(activeTab);
  const areAllCategoryItemsSelected = categoryItems.length > 0 && categoryItems.every(item => selectedItems.includes(item.id));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">Your Cart</h1>
      
       <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Please select the items you wish to purchase by checking the box next to each item.
          </AlertDescription>
        </Alert>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <div className="sticky top-20 z-40 bg-background py-4">
          <TabsList className="grid w-full grid-cols-5">
              {categories.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value}>{cat.label}</TabsTrigger>
              ))}
          </TabsList>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
                {categoryItems.length > 0 ? (
                    <div className="flex flex-col gap-4">
                       <div className="flex items-center space-x-2 rounded-md border p-2">
                          <Checkbox
                            id={`select-all-${activeTab}`}
                            checked={areAllCategoryItemsSelected}
                            onCheckedChange={() => handleToggleAll(categoryItems)}
                          />
                          <label
                            htmlFor={`select-all-${activeTab}`}
                            className="text-sm font-medium leading-none"
                          >
                            Select All in {categories.find(c => c.value === activeTab)?.label}
                          </label>
                        </div>

                        {categoryItems.map((item) => {
                          if (item.type === 'xerox') {
                            const xerox = item.xerox;
                            return (
                              <Card key={item.id} className="flex items-center overflow-hidden">
                                  <div className="p-4 flex items-center h-full">
                                      <Checkbox
                                          id={`select-${item.id}`}
                                          checked={selectedItems.includes(item.id)}
                                          onCheckedChange={() => handleToggleSelectedItem(item.id)}
                                          className="h-5 w-5"
                                       />
                                  </div>
                                  <div className="relative h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32 bg-muted flex items-center justify-center">
                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                  </div>
                                  <div className="flex flex-grow flex-col p-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex-grow">
                                      <h2 className="font-headline text-lg font-semibold truncate">{xerox.file?.name || 'Printing Job'}</h2>
                                      <p className="text-lg font-bold text-primary">Rs {item.price.toFixed(2)}</p>
                                  </div>
                                  <div className="mt-4 flex items-center gap-2 sm:mt-0">
                                      <div className="flex items-center gap-1 rounded-md border">
                                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleQuantityChange(item.id, item.quantity - 1)} disabled={item.quantity <= 1}> <Minus className="h-4 w-4" /> </Button>
                                          <Input type="number" min="1" value={item.quantity} onChange={(e) => { const newQuantity = parseInt(e.target.value, 10); if (!isNaN(newQuantity)) { handleQuantityChange(item.id, newQuantity); } }} className="h-9 w-12 border-0 text-center text-base font-medium focus-visible:ring-0" aria-label={`Quantity for ${xerox.file?.name}`} />
                                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}> <Plus className="h-4 w-4" /> </Button>
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(item.id)} aria-label={`Remove ${xerox.file?.name} from cart`}> <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" /> </Button>
                                  </div>
                                  </div>
                              </Card>
                            )
                          }
                          const product = item.product;
                          const mainImage = product.imageNames && product.imageNames.length > 0 ? product.imageNames[0] : null;
                          const hasDiscount = product.discountPrice && product.discountPrice < product.price;
                          return (
                            <Card key={product.id} className="flex items-center overflow-hidden">
                                <div className="p-4 flex items-center h-full">
                                    <Checkbox
                                        id={`select-${product.id}`}
                                        checked={selectedItems.includes(product.id)}
                                        onCheckedChange={() => handleToggleSelectedItem(product.id)}
                                        className="h-5 w-5"
                                     />
                                </div>
                                <div className="relative h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32 bg-muted">
                                  {mainImage ? (
                                      <Image
                                        src={mainImage}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                      />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground font-bold text-xl">
                                      JASA
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-grow flex-col p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex-grow">
                                    <h2 className="font-headline text-lg font-semibold">{product.name}</h2>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-lg font-bold text-primary">
                                            Rs {hasDiscount ? product.discountPrice?.toFixed(2) : product.price.toFixed(2)}
                                        </p>
                                        {hasDiscount && (
                                            <p className="text-sm text-muted-foreground line-through">
                                            Rs {product.price.toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2 sm:mt-0">
                                    <div className="flex items-center gap-1 rounded-md border">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => handleQuantityChange(product.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => {
                                                const newQuantity = parseInt(e.target.value, 10);
                                                if (!isNaN(newQuantity)) {
                                                    handleQuantityChange(product.id, newQuantity);
                                                }
                                            }}
                                            className="h-9 w-12 border-0 text-center text-base font-medium focus-visible:ring-0"
                                            aria-label={`Quantity for ${product.name}`}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => handleQuantityChange(product.id, item.quantity + 1)}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() => removeItem(product.id)}
                                        aria-label={`Remove ${product.name} from cart`}
                                    >
                                        <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                                </div>
                            </Card>
                          )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 lg:col-span-3">
                        <p className="text-muted-foreground">No items in this category.</p>
                    </div>
                )}
            </div>
            <div className="lg:col-span-1">
                {renderOrderSummary()}
            </div>
        </div>
      </Tabs>
    </div>
  );
}
