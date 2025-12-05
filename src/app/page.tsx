
"use client";

import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaCarouselType } from "embla-carousel-react";
import BannerCard from '@/components/banner-card';
import WelcomeCard from '@/components/welcome-card';
import CategoryLinkCard from '@/components/category-link-card';
import { categories as defaultCategories, getProducts, getHomepageContent } from '@/lib/data';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import PostCarousel from "@/components/post-carousel";
import type { Product, HomepageContent, Category } from "@/lib/types";
import ProductCard from "@/components/product-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Search, X, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import XeroxTicker from "@/components/xerox-ticker";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import LocationSelector from "@/components/location-selector";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";


export default function Home() {
  const AUTOPLAY_DELAY = 8000;
  const plugin = React.useRef(
    Autoplay({ 
      delay: AUTOPLAY_DELAY, 
      stopOnInteraction: false,
      stopOnLastSnap: false,
    })
  );
  
  const router = useRouter();

  const [productsByCategory, setProductsByCategory] = React.useState<{ [key in Product['category']]?: Product[] }>({});
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  const [homepageContent, setHomepageContent] = React.useState<HomepageContent | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [displayCategories, setDisplayCategories] = React.useState<Category[]>(defaultCategories);
  
  const [emblaApi, setEmblaApi] = React.useState<EmblaCarouselType | null>(null);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = React.useState<Product[]>([]);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchPageData = async () => {
      setIsLoading(true);
      try {
        const [
          all,
          stationary, 
          books, 
          electronics, 
          content
        ] = await Promise.all([
          getProducts(),
          getProducts('stationary'),
          getProducts('books'),
          getProducts('electronics'),
          getHomepageContent(),
        ]);
        setAllProducts(all);
        setProductsByCategory({ stationary, books, electronics });
        setHomepageContent(content);

        // Always use default categories, but enrich with images if they exist
        const categoriesWithImages = defaultCategories.map(cat => {
            const categoryKey = cat.href.replace('/', '') as keyof HomepageContent['categoryImages'];
            const dynamicImageUrl = content?.categoryImages?.[categoryKey];
            return { 
                ...cat, 
                image: { 
                    ...cat.image, 
                    src: dynamicImageUrl || '',
                }
            };
        });
        setDisplayCategories(categoriesWithImages);


      } catch (error) {
        console.error("Failed to fetch data for home page:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPageData();
  }, []);
  
  React.useEffect(() => {
    if (debouncedSearchQuery.length > 1) {
      const searchTerms = debouncedSearchQuery.toLowerCase().split(' ').filter(term => term);
      const results = allProducts.filter(product => {
        const productNameLower = product.name.toLowerCase();
        return searchTerms.every(term => productNameLower.includes(term));
      });
      setSearchResults(results);
      setIsSearchOpen(true);
    } else {
      setSearchResults([]);
      setIsSearchOpen(false);
    }
  }, [debouncedSearchQuery, allProducts]);
  
  React.useEffect(() => {
    if (!emblaApi) return;
  
    const onSelect = () => {
      setCurrentSlide(emblaApi.selectedScrollSnap());
      setProgress(0); // Reset progress on manual slide change
    };
  
    const onSettle = () => {
      // This is triggered after the carousel settles on a new slide.
      // We restart the progress animation here.
      setProgress(0); // Ensure it's reset
       setTimeout(() => setProgress(100), 50); // Start the animation
    };
    
    emblaApi.on("select", onSelect);
    emblaApi.on("settle", onSettle);
    onSettle(); // Initial call
  
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("settle", onSettle);
    };
  }, [emblaApi]);

  const isWelcomeVisible = homepageContent?.isWelcomeVisible ?? true;
  const visibleBanners = (homepageContent?.banners || []).filter(banner => banner.imageUrl && banner.isVisible);
  const carouselItems = [
    ...(isWelcomeVisible ? [{ type: 'welcome' }] : []),
    ...visibleBanners.map(banner => ({ type: 'banner', banner }))
  ];

  const categoryDisplayInfo = {
      stationary: { title: "Featured Stationary", href: "/stationary" },
      books: { title: "Latest Books", href: "/books" },
      electronics: { title: "Top Electronic Kits", href: "/electronics" },
  }
  
  const handleProductClick = (productId: string) => {
    router.push(`/product/${productId}`);
    setIsSearchOpen(false);
    setSearchQuery('');
  };
  
  const handleClearSearch = () => {
      setSearchQuery('');
      setIsSearchOpen(false);
  }

  const renderProductSection = (category: Product['category']) => {
    const catInfo = categoryDisplayInfo[category];
    const productList = productsByCategory[category] || [];

    if (isLoading) {
      return (
        <div>
          <div className="flex items-center justify-between pb-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="overflow-hidden">
            <Card>
              <CardContent>
                <div className="flex gap-4 overflow-x-auto py-4 no-scrollbar -mx-4 px-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-[35vw] flex-shrink-0 sm:w-40">
                          <div className="flex flex-col space-y-3">
                            <Skeleton className="h-[220px] w-full rounded-xl" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-5/6" />
                            </div>
                          </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (!productList.length || !catInfo) return null;

    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
            <h2 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">{catInfo.title}</h2>
            <Button asChild className="rounded-full bg-gradient-to-r from-blue-500 to-sky-400 text-white hover:opacity-90 transition-transform active:scale-95">
              <Link href={catInfo.href}>
                <span>View All</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
        </div>
        <div className="overflow-hidden">
          <Card>
            <CardContent className="p-4">
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
                {productList.map((product) => (
                    <div key={product.id} className="w-[35vw] flex-shrink-0 sm:w-40">
                    <ProductCard product={product} />
                    </div>
                ))}
                </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 pt-4">
        <LocationSelector />
      </div>
      <div className="overflow-hidden pt-4">
         <Carousel
          setApi={setEmblaApi}
          plugins={[plugin.current]}
          className="w-full"
          onMouseEnter={plugin.current.stop}
          onMouseLeave={plugin.current.reset}
          opts={{
            loop: carouselItems.length > 1,
          }}
        >
          <CarouselContent className="px-4 -ml-4">
            {isLoading ? (
                 <CarouselItem className="pl-4">
                    <div className="relative w-full overflow-hidden">
                        <Skeleton className="relative h-40 md:h-80 lg:h-[23rem]" />
                    </div>
                 </CarouselItem>
            ) : carouselItems.map((item, index) => {
              const cardHeight = "h-40 md:h-80 lg:h-[23rem]";
              if (item.type === 'welcome') {
                return (
                  <CarouselItem key="welcome" className="pl-4">
                    <WelcomeCard imageUrl={homepageContent?.welcomeImageUrl} className={cardHeight}/>
                  </CarouselItem>
                );
              }
              if (item.type === 'banner' && item.banner) {
                const banner = item.banner;
                return (
                  <CarouselItem key={banner.id} className="pl-4">
                    <BannerCard
                      href={banner.href}
                      title={banner.title}
                      cta={banner.cta}
                      imageSrc={banner.imageUrl}
                      imageAlt={banner.title}
                      className={cardHeight}
                    />
                  </CarouselItem>
                );
              }
              return null;
            })}
             {
              !isLoading && carouselItems.length === 0 && (
                <CarouselItem className="pl-4">
                    <div className="relative w-full overflow-hidden">
                       <div className="relative h-40 w-full rounded-2xl md:h-80 lg:h-[23rem] bg-muted flex items-center justify-center">
                          <p className="text-muted-foreground">No promotional content available right now.</p>
                       </div>
                    </div>
                 </CarouselItem>
              )
            }
          </CarouselContent>
        </Carousel>
        {carouselItems.length > 1 && (
            <div className="container mx-auto mt-2 flex justify-center gap-2 px-4">
                {carouselItems.map((_, index) => {
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
                            <span className="sr-only">Go to slide {index + 1}</span>
                        </button>
                    );
                })}
            </div>
        )}
      </div>

       <div className="container mx-auto px-4 py-2">
         <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
           <PopoverAnchor asChild>
            <div className="relative w-full">
                <Input
                  type="text"
                  placeholder="Search your product"
                  className="h-12 rounded-full border-primary pl-12 pr-10 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                   <Image src="/favicon.ico" alt="Jasa Essentials" width={32} height={32} className="rounded-full border-2 border-primary" />
                </span>
                 <Button
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-2 flex items-center h-8 w-8 my-auto rounded-full text-muted-foreground"
                    onClick={isSearchOpen ? handleClearSearch : undefined}
                >
                  {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                </Button>
            </div>
           </PopoverAnchor>
           <PopoverContent className="w-[--radix-popover-trigger-width] p-2">
            <div className="max-h-60 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(product => (
                  <Button
                    key={product.id}
                    variant="ghost"
                    className="w-full justify-between h-auto p-2"
                    onClick={() => handleProductClick(product.id)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="relative h-10 w-10 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                        {product.imageNames?.[0] ? (
                          <Image src={product.imageNames[0]} alt={product.name} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">JASA</div>
                        )}
                      </div>
                      <span className="truncate text-left text-sm">{product.name}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </Button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No products found.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
       
       <div className="py-8">
          <Card className="bg-muted w-full rounded-none">
              <CardHeader>
                  <CardTitle className="text-center font-headline text-2xl font-bold tracking-tight sm:text-3xl">
                      OUR SERVICES
                  </CardTitle>
              </CardHeader>
              <CardContent className="container mx-auto px-4">
                  <div className="grid grid-cols-4 w-full gap-4">
                      {displayCategories.map((category, index) => (
                          <CategoryLinkCard key={category.id} category={category} index={index} />
                      ))}
                  </div>
              </CardContent>
          </Card>
       </div>

       <div className="container mx-auto px-4 space-y-8">
         <div className="overflow-hidden py-8">
            <XeroxTicker />
         </div>

         <div className="overflow-hidden">
          {renderProductSection('stationary')}
         </div>
         <div className="overflow-hidden">
          {renderProductSection('books')}
         </div>
         <div className="overflow-hidden">
          {renderProductSection('electronics')}
         </div>

        <div className="py-8">
          <PostCarousel />
        </div>
       </div>
    </div>
  );
}
