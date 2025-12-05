
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/auth-provider";
import { useRouter } from "next/navigation";
import { getOrderSettings, updateOrderSettings } from "@/lib/data";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const settingsSchema = z.object({
  itemDeliveryCharge: z.coerce.number().min(0, "Must be a positive number."),
  minItemOrderForFreeDelivery: z.coerce.number().min(0, "Must be a positive number."),
  minXeroxOrderPrice: z.coerce.number().min(0, "Must be a positive number."),
  xeroxDeliveryCharge: z.coerce.number().min(0, "Must be a positive number."),
});

const defaultSettings = {
  itemDeliveryCharge: 0,
  minItemOrderForFreeDelivery: 0,
  minXeroxOrderPrice: 0,
  xeroxDeliveryCharge: 0,
};

export default function OrderSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettings,
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user || !user.roles.includes("admin")) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to view this page.",
        });
        router.push("/");
      } else {
        fetchSettings();
      }
    }
  }, [user, authLoading, router, toast]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getOrderSettings();
      // Ensure all fields are defined before resetting the form
      const fullSettings = { ...defaultSettings, ...settings };
      form.reset(fullSettings);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch settings: ${error.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSubmitting(true);
    try {
      await updateOrderSettings(values);
      toast({
        title: "Settings Saved",
        description: "Your order settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Card className="mt-8">
            <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
            <CardContent className="space-y-8">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full mt-4" />
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">
        Order Settings
      </h1>
      <p className="mt-2 text-muted-foreground">
        Manage delivery charges and minimum order values.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="mt-8 space-y-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Item Delivery Charges</CardTitle>
              <CardDescription>
                Set the delivery fee for Stationary, Books, and Electronic Kits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <FormField
                control={form.control}
                name="minItemOrderForFreeDelivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Total for FREE Delivery</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 500" {...field} />
                    </FormControl>
                    <FormDescription>
                      If the cart value for items exceeds this, delivery is free.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="itemDeliveryCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Charge</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 40" {...field} /></FormControl>
                    <FormDescription>
                      This flat fee is applied if the minimum for free delivery is not met.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Xerox Orders</CardTitle>
              <CardDescription>
                Settings specifically for Xerox & Printing services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="minXeroxOrderPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Order for Free Delivery</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="xeroxDeliveryCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Charge</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 25" {...field} />
                    </FormControl>
                     <FormDescription>
                      This flat fee is applied if the minimum for free delivery is not met.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
