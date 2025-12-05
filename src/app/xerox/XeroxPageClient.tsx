
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getXeroxServices, getXeroxOptions, getPaperSamples } from "@/lib/data";
import type { XeroxService, XeroxOption, PaperSample } from "@/lib/types";
import { HARDCODED_XEROX_OPTIONS } from "@/lib/xerox-options";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Loader2, FileUp, XCircle, FileText, ShoppingCart, Plus, Minus, Pencil, ListOrdered, Images, Link as LinkIcon, CheckCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger
} from "@/components/ui/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHeader,
  TableHead
} from "@/components/ui/table";


// Set up worker for pdf.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

type DocumentState = {
  id: number;
  file: File;
  fileDetails: { name: string; type: string; pages?: number; url?: string; } | null;
  selectedPaperType: string;
  currentPaperDetails: XeroxOption | null;
  selectedColorOption: string;
  selectedFormatType: string;
  selectedPrintRatio: string;
  selectedBindingType: string;
  selectedLaminationType: string;
  quantity: number;
  message: string;
};

type UploadStatus = {
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    url?: string;
    error?: string;
};

const MAX_WORDS = 100;

export default function XeroxPageClient() {
  const [services, setServices] = useState<XeroxService[]>([]);
  const [paperTypes, setPaperTypes] = useState<XeroxOption[]>([]);
  const [paperSamples, setPaperSamples] = useState<PaperSample[]>([]);
  const [allOptions, setAllOptions] = useState<{
      bindingTypes: XeroxOption[],
      laminationTypes: XeroxOption[],
  }>({
      bindingTypes: [],
      laminationTypes: [],
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentState[]>([]);
  const nextId = useRef(0);
  
  const [editingDocument, setEditingDocument] = useState<DocumentState | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<Record<number, UploadStatus>>({});
  const [isRedirecting, setIsRedirecting] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [fetchedServices, fetchedPaperTypes, bindingTypes, laminationTypes, fetchedPaperSamples] = await Promise.all([
          getXeroxServices(),
          getXeroxOptions('paperType'),
          getXeroxOptions('bindingType'),
          getXeroxOptions('laminationType'),
          getPaperSamples(),
        ]);
        setServices(fetchedServices);
        setPaperTypes(fetchedPaperTypes);
        setAllOptions({ bindingTypes, laminationTypes });
        setPaperSamples(fetchedPaperSamples);
        
      } catch (err) {
        setError("Failed to load printing services. Please try again later.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (searchParams.get('upload') === 'true' && fileInputRef.current) {
        fileInputRef.current.click();
    }
  }, [searchParams]);

  const addNewDocument = async (file: File) => {
    const newDocId = nextId.current++;
    const defaultPaperType = paperTypes.length > 0 ? paperTypes[0] : null;

    // Show initial state immediately
    const initialDocumentState: DocumentState = {
      id: newDocId,
      file: file,
      fileDetails: { name: file.name, type: file.type },
      selectedPaperType: defaultPaperType?.id || '',
      currentPaperDetails: defaultPaperType,
      selectedColorOption: defaultPaperType?.colorOptionIds?.[0] || '',
      selectedFormatType: defaultPaperType?.formatTypeIds?.[0] || '',
      selectedPrintRatio: defaultPaperType?.printRatioIds?.[0] || '',
      selectedBindingType: 'none',
      selectedLaminationType: 'none',
      quantity: 1,
      message: '',
    };
    setDocuments(prev => [...prev, initialDocumentState]);

    // Then, asynchronously get page count
    const pages = await getPageCount(file);
    if (pages !== undefined) {
      updateDocumentState(newDocId, { fileDetails: { ...initialDocumentState.fileDetails!, pages } });
    } else {
      // Handle error case where page count couldn't be determined
      removeDocument(newDocId);
    }
  };
  
  const updateDocumentState = (id: number, updates: Partial<DocumentState>) => {
    setDocuments(prev =>
      prev.map(doc => {
        if (doc.id === id) {
          const updatedDoc = { ...doc, ...updates };
          if ('selectedPaperType' in updates && updates.selectedPaperType !== doc.selectedPaperType) {
            const newPaperDetails = paperTypes.find(pt => pt.id === updates.selectedPaperType) || null;
            updatedDoc.currentPaperDetails = newPaperDetails;
            if (newPaperDetails) {
                if (!newPaperDetails.colorOptionIds?.includes(updatedDoc.selectedColorOption)) updatedDoc.selectedColorOption = newPaperDetails.colorOptionIds?.[0] || '';
                if (!newPaperDetails.formatTypeIds?.includes(updatedDoc.selectedFormatType)) updatedDoc.selectedFormatType = newPaperDetails.formatTypeIds?.[0] || '';
                if (!newPaperDetails.printRatioIds?.includes(updatedDoc.selectedPrintRatio)) updatedDoc.selectedPrintRatio = newPaperDetails.printRatioIds?.[0] || '';
                if (!newPaperDetails.bindingTypeIds?.includes(updatedDoc.selectedBindingType)) updatedDoc.selectedBindingType = 'none';
                if (!newPaperDetails.laminationTypeIds?.includes(updatedDoc.selectedLaminationType)) updatedDoc.selectedLaminationType = 'none';
            }
          }
          return updatedDoc;
        }
        return doc;
      })
    );
  };
  
  const removeDocument = (id: number) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };


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
  
  const handleMultipleFileChanges = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        addNewDocument(file);
      });
      e.target.value = '';
    }
  }

  const calculateDocumentPrice = useCallback((doc: DocumentState) => {
    if (!doc.currentPaperDetails || !doc.fileDetails?.pages) return 0;
      
    const colorOption = HARDCODED_XEROX_OPTIONS.colorOptions.find(o => o.id === doc.selectedColorOption);
    const formatType = HARDCODED_XEROX_OPTIONS.formatTypes.find(o => o.id === doc.selectedFormatType);
    const printRatio = HARDCODED_XEROX_OPTIONS.printRatios.find(o => o.id === doc.selectedPrintRatio);
    const bindingType = allOptions.bindingTypes.find(o => o.id === doc.selectedBindingType);
    const laminationType = allOptions.laminationTypes.find(o => o.id === doc.selectedLaminationType);
    
    const pricePerPage = colorOption?.name === 'Gradient / Colour' ? doc.currentPaperDetails.priceColor ?? 0 : doc.currentPaperDetails.priceBw ?? 0;
    const documentPages = doc.fileDetails.pages;
    
    const physicalPages = formatType?.name === 'Front and Back' ? Math.ceil(documentPages / 2) : documentPages;
    let printingCost = physicalPages * pricePerPage;

    if (printRatio?.name === '1:2 (Two pages per sheet)') {
        printingCost /= 2;
    }

    const bindingCost = bindingType?.price || 0;
    const laminationCost = laminationType?.price || 0;

    const singleCopyPrice = printingCost + bindingCost + laminationCost;
    return singleCopyPrice * doc.quantity;
  }, [allOptions.bindingTypes, allOptions.laminationTypes]);

  const documentPrices = useMemo(() => {
    return documents.map(doc => ({
      id: doc.id,
      price: calculateDocumentPrice(doc)
    }));
  }, [documents, calculateDocumentPrice]);

  const finalTotalPrice = useMemo(() => {
    return documentPrices.reduce((total, item) => total + item.price, 0);
  }, [documentPrices]);
  
    const uploadSingleDocument = async (doc: DocumentState) => {
        setUploadStatus(prev => ({
            ...prev,
            [doc.id]: { status: 'uploading', progress: 0 }
        }));

        try {
            const fd = new FormData();
            fd.append("file", doc.file);

            // Using XMLHttpRequest for progress tracking
            return await new Promise<string>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/api/upload", true);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        setUploadStatus(prev => ({
                            ...prev,
                            [doc.id]: { ...prev[doc.id], progress: percentComplete }
                        }));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const response = JSON.parse(xhr.responseText);
                        setUploadStatus(prev => ({
                            ...prev,
                            [doc.id]: { ...prev[doc.id], status: 'success', progress: 100, url: response.url }
                        }));
                        resolve(response.url);
                    } else {
                        const errorResponse = JSON.parse(xhr.responseText);
                        setUploadStatus(prev => ({
                            ...prev,
                            [doc.id]: { status: 'error', progress: 0, error: errorResponse.error || 'Upload failed' }
                        }));
                        reject(new Error(errorResponse.error || `Upload failed for ${doc.file.name}`));
                    }
                };

                xhr.onerror = () => {
                    setUploadStatus(prev => ({
                        ...prev,
                        [doc.id]: { status: 'error', progress: 0, error: 'Network error' }
                    }));
                    reject(new Error("Network error during upload."));
                };

                xhr.send(fd);
            });
        } catch (error: any) {
            setUploadStatus(prev => ({
                ...prev,
                [doc.id]: { status: 'error', progress: 0, error: error.message }
            }));
            throw error;
        }
    };
    
    const handleCheckout = async () => {
        setIsUploading(true);
        setIsRedirecting(false);

        const initialStatuses: Record<number, UploadStatus> = {};
        documents.forEach(doc => {
            initialStatuses[doc.id] = { status: 'pending', progress: 0 };
        });
        setUploadStatus(initialStatuses);
        
        const uploadPromises = documents.map(doc => uploadSingleDocument(doc));

        try {
            const urls = await Promise.all(uploadPromises);

            const xeroxJobsForStorage = documents.map((doc, index) => {
                const price = documentPrices.find(p => p.id === doc.id)?.price || 0;
                return {
                    id: `${Date.now()}-${doc.id}`,
                    fileDetails: {
                        name: doc.fileDetails!.name,
                        type: doc.fileDetails!.type,
                        url: urls[index],
                    },
                    pageCount: doc.fileDetails!.pages || 0,
                    price: price / doc.quantity,
                    config: {
                        paperType: doc.selectedPaperType,
                        colorOption: doc.selectedColorOption,
                        formatType: doc.selectedFormatType,
                        printRatio: doc.selectedPrintRatio,
                        bindingType: doc.selectedBindingType,
                        laminationType: doc.selectedLaminationType,
                        quantity: doc.quantity,
                        message: doc.message,
                    }
                };
            });

            sessionStorage.setItem('xeroxCheckoutJobs', JSON.stringify(xeroxJobsForStorage));
            
            setIsRedirecting(true);
            setTimeout(() => {
                router.push('/xerox/checkout');
                setIsUploading(false);
            }, 5000);

        } catch (error) {
            console.error("One or more uploads failed.", error);
            toast({
                variant: 'destructive',
                title: "Upload Failed",
                description: "One or more documents failed to upload. Please retry the failed uploads."
            });
            // We don't set isUploading to false here, so the dialog stays open for retries.
        }
    };

    const handleRetry = (docId: number) => {
        const docToRetry = documents.find(d => d.id === docId);
        if (docToRetry) {
            uploadSingleDocument(docToRetry).catch(err => {
                // Error is handled inside uploadSingleDocument
                console.error("Retry failed", err);
            });
        }
    };

  
  const EditDocumentDialog = ({ doc, index, onSave }: { doc: DocumentState | null, index: number, onSave: (updatedDoc: DocumentState) => void }) => {
    const [localDoc, setLocalDoc] = useState<DocumentState | null>(doc);
  
    useEffect(() => {
      setLocalDoc(doc);
    }, [doc]);
  
    if (!localDoc) return null;
  
    const handleLocalUpdate = (updates: Partial<DocumentState>) => {
      setLocalDoc(prev => {
        if (!prev) return null;
        const updatedDoc = { ...prev, ...updates };

        if ('selectedPaperType' in updates && updates.selectedPaperType !== prev.selectedPaperType) {
          const newPaperDetails = paperTypes.find(pt => pt.id === updates.selectedPaperType) || null;
          updatedDoc.currentPaperDetails = newPaperDetails;
          if (newPaperDetails) {
            if (!newPaperDetails.colorOptionIds?.includes(updatedDoc.selectedColorOption)) updatedDoc.selectedColorOption = newPaperDetails.colorOptionIds?.[0] || '';
            if (!newPaperDetails.formatTypeIds?.includes(updatedDoc.selectedFormatType)) updatedDoc.selectedFormatType = newPaperDetails.formatTypeIds?.[0] || '';
            if (!newPaperDetails.printRatioIds?.includes(updatedDoc.selectedPrintRatio)) updatedDoc.selectedPrintRatio = newPaperDetails.printRatioIds?.[0] || '';
            if (!newPaperDetails.bindingTypeIds?.includes(updatedDoc.selectedBindingType)) updatedDoc.selectedBindingType = 'none';
            if (!newPaperDetails.laminationTypeIds?.includes(updatedDoc.selectedLaminationType)) updatedDoc.selectedLaminationType = 'none';
          }
        }
        return updatedDoc;
      });
    };
  
    const renderOptionSelect = (
        id: string, label: string, selectedValue: string | undefined,
        onValueChange: (value: string) => void,
        optionIds: string[] | undefined, allOptionList: { id: string, name: string, price?: number }[],
        includeNone: boolean = false
    ) => {
        if (!optionIds || optionIds.length === 0) return null;
        
        const availableOptions = allOptionList.filter(opt => optionIds.includes(opt.id));
        if (availableOptions.length === 0 && !includeNone) return null;

        return (
            <div>
                <Label htmlFor={id}>{label}</Label>
                <Select value={selectedValue} onValueChange={onValueChange} disabled={isLoading}>
                    <SelectTrigger id={id}><SelectValue placeholder={`Select ${label.toLowerCase()}...`} /></SelectTrigger>
                    <SelectContent>
                        {includeNone && <SelectItem value="none">No {label}</SelectItem>}
                        {availableOptions.map(opt => (
                            <SelectItem key={opt.id} value={opt.id}>
                                {opt.name} {opt.price ? `(Rs ${opt.price.toFixed(2)})` : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        );
    }
    
    const wordCount = localDoc.message?.trim().split(/\s+/).filter(Boolean).length || 0;
  
    return (
      <Dialog open={!!doc} onOpenChange={(open) => {
          if (!open) {
              if (localDoc) onSave(localDoc);
              setEditingDocument(null);
          }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Options for: Document {index + 1}</DialogTitle>
            <DialogDescription>{localDoc.fileDetails?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
                <Label htmlFor={`paper-type-${localDoc.id}`}>Paper Type</Label>
                <Select
                  value={localDoc.selectedPaperType}
                  onValueChange={value => handleLocalUpdate({ selectedPaperType: value })}
                  disabled={isLoading}
                >
                    <SelectTrigger id={`paper-type-${localDoc.id}`}>
                        <SelectValue placeholder="Select paper type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {paperTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {renderOptionSelect(`color-option-${localDoc.id}`, 'Color', localDoc.selectedColorOption, value => handleLocalUpdate({ selectedColorOption: value }), localDoc.currentPaperDetails?.colorOptionIds, HARDCODED_XEROX_OPTIONS.colorOptions)}
            {renderOptionSelect(`format-type-${localDoc.id}`, 'Format', localDoc.selectedFormatType, value => handleLocalUpdate({ selectedFormatType: value }), localDoc.currentPaperDetails?.formatTypeIds, HARDCODED_XEROX_OPTIONS.formatTypes)}
            {renderOptionSelect(`print-ratio-${localDoc.id}`, 'Print Ratio', localDoc.selectedPrintRatio, value => handleLocalUpdate({ selectedPrintRatio: value }), localDoc.currentPaperDetails?.printRatioIds, HARDCODED_XEROX_OPTIONS.printRatios)}
            {renderOptionSelect(`binding-type-${localDoc.id}`, 'Binding Type', localDoc.selectedBindingType, value => handleLocalUpdate({ selectedBindingType: value }), localDoc.currentPaperDetails?.bindingTypeIds, allOptions.bindingTypes, true)}
            {renderOptionSelect(`lamination-type-${localDoc.id}`, 'Lamination Type', localDoc.selectedLaminationType, value => handleLocalUpdate({ selectedLaminationType: value }), localDoc.currentPaperDetails?.laminationTypeIds, allOptions.laminationTypes, true)}
            <div>
                <Label htmlFor={`quantity-${localDoc.id}`}>Quantity</Label>
                <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => handleLocalUpdate({ quantity: Math.max(1, localDoc.quantity - 1) })}> <Minus className="h-4 w-4" /> </Button>
                    <Input id={`quantity-${localDoc.id}`} type="number" min="1" value={localDoc.quantity} onChange={(e) => handleLocalUpdate({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="h-9 w-20 text-center" />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => handleLocalUpdate({ quantity: localDoc.quantity + 1 })}> <Plus className="h-4 w-4" /> </Button>
                </div>
            </div>
            <div>
                <Label htmlFor={`message-${localDoc.id}`}>Special Instructions (Optional)</Label>
                <Textarea 
                    id={`message-${localDoc.id}`} 
                    placeholder="e.g., 'Please use a thick cover for binding.'"
                    value={localDoc.message}
                    onChange={e => handleLocalUpdate({ message: e.target.value })}
                    className="mt-2"
                />
                <p className={cn("text-xs mt-1", wordCount > MAX_WORDS ? "text-destructive" : "text-muted-foreground")}>
                    {wordCount} / {MAX_WORDS} words
                </p>
            </div>
          </div>
           <DialogFooter>
                <DialogClose asChild>
                    <Button variant="secondary" className="w-full">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const DocumentCard = ({ document, index }: { document: DocumentState, index: number }) => {
    const singleDocPrice = documentPrices.find(p => p.id === document.id)?.price || 0;
    const pricePerPage = document.fileDetails?.pages ? (singleDocPrice / document.quantity) / document.fileDetails.pages : 0;
    
    return (
        <Card className="relative">
            <CardHeader className="p-4 flex flex-row justify-between items-center bg-muted/50">
                 <p className="font-semibold truncate">Document {index + 1}</p>
                 <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeDocument(document.id)}>
                    <XCircle className="h-5 w-5 text-red-500" />
                </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
                <div className="p-2 border rounded-md w-full overflow-x-auto no-scrollbar">
                    <p className="text-sm font-medium whitespace-nowrap">{document.fileDetails?.name || "Processing..."}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-2 border rounded-md">
                        <p className="text-xs text-muted-foreground">Document Type</p>
                        <p className="text-sm font-medium uppercase">{document.fileDetails?.type.split('/')[1] || 'N/A'}</p>
                    </div>
                     <div className="p-2 border rounded-md">
                        <p className="text-xs text-muted-foreground">No. of Pages</p>
                        {document.fileDetails?.pages === undefined ? <Loader2 className="h-5 w-5 animate-spin"/> : <p className="text-sm font-medium">{document.fileDetails.pages}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <Label className="text-xs mb-1">Paper Type</Label>
                        <Select value={document.selectedPaperType} onValueChange={(v) => updateDocumentState(document.id, {selectedPaperType: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {paperTypes.map(pt => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col">
                        <Label className="text-xs mb-1">Other Options</Label>
                        <Button type="button" variant="outline" onClick={() => setEditingDocument(document)}>
                            <Pencil className="mr-2 h-4 w-4"/> Edit Options
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-2 border rounded-md">
                        <p className="text-xs text-muted-foreground">Price per page</p>
                        <p className="text-sm font-medium">Rs {pricePerPage.toFixed(2)}</p>
                    </div>
                     <div className="p-2 border rounded-md">
                        <p className="text-xs text-muted-foreground">Final Price</p>
                        <p className="text-sm font-medium">Rs {singleDocPrice.toFixed(2)}</p>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
  };
  
  const FinalEstimation = () => {
    if (documents.length === 0) return null;

    const getOptionName = (type: 'paperType' | 'colorOption' | 'formatType' | 'printRatio' | 'bindingType' | 'laminationType', id: string): string => {
        if (!id || id === 'none') return '';
        if (type === 'paperType') return paperTypes.find(o => o.id === id)?.name || '';
        if (type === 'colorOption') return HARDCODED_XEROX_OPTIONS.colorOptions.find(o => o.id === id)?.name || '';
        if (type === 'formatType') return HARDCODED_XEROX_OPTIONS.formatTypes.find(o => o.id === id)?.name || '';
        if (type === 'printRatio') return HARDCODED_XEROX_OPTIONS.printRatios.find(o => o.id === id)?.name || '';
        if (type === 'bindingType') return allOptions.bindingTypes.find(o => o.id === id)?.name || '';
        if (type === 'laminationType') return allOptions.laminationTypes.find(o => o.id === id)?.name || '';
        return '';
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Final Estimation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {documents.map((doc, index) => {
              const docPrice = documentPrices.find(p => p.id === doc.id)?.price || 0;
              const details = [
                { key: 'Paper', value: getOptionName('paperType', doc.selectedPaperType) },
                { key: 'Color', value: getOptionName('colorOption', doc.selectedColorOption) },
                { key: 'Format', value: getOptionName('formatType', doc.selectedFormatType) },
                { key: 'Ratio', value: getOptionName('printRatio', doc.selectedPrintRatio) },
                { key: 'Binding', value: getOptionName('bindingType', doc.selectedBindingType) },
                { key: 'Lamination', value: getOptionName('laminationType', doc.selectedLaminationType) },
              ].filter(d => d.value);

              return (
                <div key={doc.id} className="border-b pb-3 mb-3">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-medium truncate max-w-xs flex-1">Doc {index + 1}: {doc.fileDetails?.name}</p>
                        <div className="text-right">
                           <p className="font-semibold">Rs {docPrice.toFixed(2)}</p>
                           <p className="text-muted-foreground text-xs">{doc.quantity} x copies</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {details.map(d => (
                            <div key={d.key} className="flex">
                                <span className="font-semibold text-foreground/80 w-16 shrink-0">{d.key}:</span>
                                <span>{d.value}</span>
                            </div>
                        ))}
                    </div>
                    
                    {doc.message && (
                        <div className="mt-2 text-xs text-muted-foreground">
                             <span className="font-semibold text-foreground/80">Note:</span> {doc.message}
                        </div>
                    )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between font-bold text-base border-t-2 pt-2">
            <p>Final Price</p>
            <p>Rs {finalTotalPrice.toFixed(2)}</p>
          </div>
          <Button 
            size="lg" 
            className="w-full"
            onClick={handleCheckout}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Confirm & Proceed to Checkout
          </Button>
        </CardContent>
      </Card>
    );
  };


  const renderInitialState = () => (
    <div className="container mx-auto px-4 py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-300 via-sky-100 to-white dark:from-sky-800 dark:via-sky-900 dark:to-black rounded-2xl"></div>
        <Card className="relative z-10 text-center p-8 border-0 bg-transparent rounded-2xl h-64 md:h-52 flex flex-col justify-center">
            <CardHeader>
                <FileUp className="mx-auto h-12 w-12 text-black dark:text-white" />
                <CardTitle className="text-2xl text-black dark:text-white">Start Your Printing Order</CardTitle>
                <CardDescription className="text-gray-800 dark:text-gray-200">Upload your documents to get started.</CardDescription>
            </CardHeader>
            <CardContent>
             <div className="relative w-full h-14 overflow-hidden rounded-full">
                <Button
                    type="button"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full bg-black text-white hover:bg-gray-800 rounded-full relative"
                >
                    <div className="shining-button" />
                    <FileUp className="mr-2 h-4 w-4" /> Upload Documents
                </Button>
            </div>
            <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleMultipleFileChanges}
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            />
            </CardContent>
        </Card>
    </div>
  );
  
  const PriceListDialog = () => (
    <Dialog>
        <DialogTrigger asChild>
            <Button className="bg-[#4169E1] hover:bg-[#4169E1]/90 transition-transform active:scale-95"><ListOrdered className="mr-2 h-4 w-4"/> View Price List</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Xerox & Printing Price List</DialogTitle>
                <DialogDescription>
                    Prices for various printing and finishing services.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow">
                <div className="pr-6">
                    {error ? (
                        <p className="text-center text-destructive">{error}</p>
                    ) : isLoading ? (
                        <div className="space-y-2">
                           <Skeleton className="h-8 w-full" />
                           <Skeleton className="h-8 w-full" />
                           <Skeleton className="h-8 w-full" />
                        </div>
                    ) : services.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground">
                            No printing services are available at the moment.
                        </p>
                    ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Service</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {services.map((service) => {
                            const hasDiscount = service.discountPrice != null && service.discountPrice < service.price;
                            return (
                            <TableRow key={service.id}>
                                <TableCell className="font-medium">
                                    <p>{service.name}</p>
                                    {service.unit && <p className="text-xs text-muted-foreground">{service.unit}</p>}
                                </TableCell>
                                <TableCell className="text-right">
                                {hasDiscount ? (
                                    <div className="flex flex-col items-end">
                                        <span className="text-base font-bold">Rs {service.discountPrice?.toFixed(2)}</span>
                                        <span className="text-xs text-muted-foreground line-through">Rs {service.price.toFixed(2)}</span>
                                    </div>
                                ) : (
                                    <span className="text-base font-bold">Rs {service.price.toFixed(2)}</span>
                                )}
                                </TableCell>
                            </TableRow>
                            );
                        })}
                        </TableBody>
                    </Table>
                    )}
                </div>
            </ScrollArea>
             <DialogFooter>
                <DialogClose asChild>
                    <Button variant="destructive" className="transition-transform active:scale-95">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );

  const PaperSamplesDialog = () => (
    <Dialog>
        <DialogTrigger asChild>
            <Button className="bg-[#4169E1] hover:bg-[#4169E1]/90 transition-transform active:scale-95"><Images className="mr-2 h-4 w-4"/> View Formats</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Paper Sample Formats</DialogTitle>
                <DialogDescription>
                    Visual examples of different paper types.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow">
                <div className="pr-6 space-y-4">
                    {isLoading ? (
                        <p>Loading samples...</p>
                    ) : paperSamples.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No samples available.</p>
                    ) : (
                        paperSamples.map(sample => (
                            <Card key={sample.id}>
                                <CardHeader>
                                    <CardTitle>{sample.name}</CardTitle>
                                    <CardDescription>{sample.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Carousel>
                                        <CarouselContent>
                                            {sample.imageUrls.map((url, i) => (
                                                <CarouselItem key={i}>
                                                    <div className="relative aspect-video">
                                                        <Image src={url} alt={`${sample.name} ${i+1}`} fill className="object-contain rounded-md" />
                                                    </div>
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        {sample.imageUrls.length > 1 && (
                                            <>
                                            <CarouselPrevious />
                                            <CarouselNext />
                                            </>
                                        )}
                                    </Carousel>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="destructive" className="transition-transform active:scale-95">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );

  const allUploadsSuccessful = useMemo(() => {
    if (documents.length === 0) return false;
    return documents.every(doc => uploadStatus[doc.id]?.status === 'success');
  }, [documents, uploadStatus]);


  return (
    <>
    <Dialog open={isUploading}>
        <DialogContent hideCloseButton={true}>
            <DialogHeader>
                <DialogTitle>{isRedirecting ? 'Upload Complete!' : 'Uploading Documents...'}</DialogTitle>
                <DialogDescription>
                    {isRedirecting
                        ? 'Your documents have been uploaded. Redirecting to checkout...'
                        : 'Please wait while we upload your documents. Do not close this window.'
                    }
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {isRedirecting ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <CheckCircle className="h-16 w-16 text-green-500"/>
                    </div>
                ) : (
                    documents.map(doc => {
                        const status = uploadStatus[doc.id];
                        return (
                            <div key={doc.id} className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <p className="truncate font-medium flex items-center gap-2">
                                        {status?.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {status?.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                        {status?.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                                        <span className="truncate max-w-[200px] sm:max-w-xs">{doc.file.name}</span>
                                    </p>
                                    {status?.status === 'error' && (
                                        <Button size="sm" variant="outline" onClick={() => handleRetry(doc.id)}>
                                            <RefreshCw className="mr-2 h-4 w-4"/> Retry
                                        </Button>
                                    )}
                                </div>
                                {status?.status === 'uploading' && (
                                    <Progress value={status.progress} />
                                )}
                                {status?.status === 'error' && (
                                    <p className="text-xs text-destructive">{status.error}</p>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
            {!isRedirecting && (
                 <DialogFooter>
                    <Button variant="outline" disabled>
                        Cancel
                    </Button>
                </DialogFooter>
            )}
        </DialogContent>
    </Dialog>

    <div className="pb-24">
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="font-headline text-3xl font-bold tracking-tight lg:text-4xl">
          Xerox & Printing Services
        </h1>
        <p className="mt-4 text-muted-foreground">
          High-quality photocopying and printing at competitive prices.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <PriceListDialog />
          <PaperSamplesDialog />
        </div>
      </div>

      
      {editingDocument && <EditDocumentDialog doc={editingDocument} index={documents.findIndex(d => d.id === editingDocument.id)} onSave={(updatedDoc) => updateDocumentState(updatedDoc.id, updatedDoc)} />}

       {documents.length === 0 && !isLoading ? renderInitialState() : (
         <div className="container mx-auto px-4 py-8 space-y-4">
            {documents.map((doc, index) => (
              <DocumentCard key={doc.id} document={doc} index={index} />
            ))}
            
            <Input 
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleMultipleFileChanges}
                accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            />
            <FinalEstimation />
        </div>
       )}

        {documents.length > 0 && (
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    type="button"
                    className="rounded-full h-12 shadow-lg flex items-center justify-center gap-2 px-4"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Plus className="h-5 w-5" />
                    <span className="font-semibold text-sm">Add Another Document</span>
                </Button>
            </div>
        )}
    </div>
    </>
  );
}
