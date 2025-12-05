
"use client";

import { useState, useEffect, useRef } from "react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaCarouselType } from "embla-carousel-react";
import { getXeroxServices } from "@/lib/data";
import type { XeroxService } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function XeroxTicker() {
  const [services, setServices] = useState<XeroxService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const AUTOPLAY_DELAY = 4000;
  const plugin = useRef(Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: false }));
  
  const [emblaApi, setEmblaApi] = useState<EmblaCarouselType | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchServices = async () => {
      setIsLoading(true);
      try {
        const fetchedServices = await getXeroxServices();
        setServices(fetchedServices);
      } catch (error) {
        console.error("Failed to fetch xerox services:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
  
    const onSelect = () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
      setProgress(0);
    };
  
    const onSettle = () => {
      setProgress(0);
      setTimeout(() => setProgress(100), 50);
    };
    
    emblaApi.on("select", onSelect);
    emblaApi.on("settle", onSettle);
    onSettle();
  
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("settle", onSettle);
    };
  }, [emblaApi]);

  if (isLoading) {
    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-24" />
            </div>
            <div className="flex gap-4">
                <Skeleton className="h-40 w-full basis-1/2 md:basis-1/3 lg:basis-1/4" />
                <Skeleton className="h-40 w-full basis-1/2 md:basis-1/3 lg:basis-1/4" />
                <Skeleton className="h-40 w-full hidden md:block md:basis-1/3 lg:basis-1/4" />
                <Skeleton className="h-40 w-full hidden lg:block lg:basis-1/4" />
            </div>
        </div>
    );
  }

  if (services.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Xerox & Printing</h2>
        <Button asChild className="rounded-full bg-gradient-to-r from-blue-500 to-sky-400 text-white hover:opacity-90 transition-transform active:scale-95">
          <Link href="/xerox?upload=true">
            <FileUp className="mr-2 h-4 w-4 text-white" />
            <span>Print Now</span>
          </Link>
        </Button>
      </div>

      <Carousel
        setApi={setEmblaApi}
        plugins={[plugin.current]}
        opts={{
          loop: true,
          align: "start",
        }}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        <CarouselContent className="-ml-4">
          {services.map((service) => {
            const hasDiscount = service.discountPrice != null && service.discountPrice < service.price;
            const discountPercent = hasDiscount ? Math.round(((service.price - service.discountPrice!) / service.price) * 100) : 0;
            return (
              <CarouselItem key={service.id} className="pl-4 basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                <Link href="/xerox" className="block h-full">
                  <Card className="h-full bg-gray-200 dark:bg-white text-black transition-transform duration-300 hover:scale-105">
                    <CardContent className="flex h-full flex-col justify-between p-4">
                      <div>
                        <p className="font-bold text-primary truncate">{service.name}</p>
                        {service.unit && <p className="text-xs text-gray-600 dark:text-gray-700">{service.unit}</p>}
                      </div>
                      <div className="mt-4 text-right">
                        {hasDiscount && (
                              <Badge variant="destructive" className="mb-1">{discountPercent}% OFF</Badge>
                        )}
                        {hasDiscount ? (
                          <div>
                            <p className="text-sm text-gray-500 line-through">
                              Rs {service.price.toFixed(2)}
                            </p>
                            <p className="text-2xl font-bold">
                              Rs {service.discountPrice?.toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xl font-bold">
                            Rs {service.price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
      {services.length > 1 && (
        <div className="mt-2 flex justify-center gap-2">
            {services.map((_, index) => {
                const isActive = index === currentSlide;
                return (
                    <button
                        key={index}
                        className={cn(
                            "h-2 rounded-full bg-muted transition-all duration-300 relative overflow-hidden",
                            isActive ? "w-6" : "w-2 hover:bg-muted-foreground"
                        )}
                        onClick={() => emblaApi?.scrollTo(index)}
                    >
                        {isActive && (
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-primary"
                                style={{
                                  width: `${progress}%`,
                                  transition: progress > 1 ? `width ${AUTOPLAY_DELAY}ms linear` : 'none',
                                }}
                            />
                        )}
                        <span className="sr-only">Go to service slide {index + 1}</span>
                    </button>
                );
            })}
        </div>
      )}
    </div>
  );
}
